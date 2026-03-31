import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const SKILL_ID = "capture.link_to_apple_notes";
const MAX_BUFFER_BYTES = 20 * 1024 * 1024;

function registerPrimitive(handlers, skillId, actionId, handler) {
  handlers[actionId] = handler;
  handlers[JSON.stringify([skillId, actionId])] = handler;
}

function requireString(value, fieldName) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${fieldName} must be a non-empty string.`);
  }

  return value.trim();
}

function optionalString(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function previewText(value, limit = 280) {
  const compact = value.replace(/\s+/g, " ").trim();

  if (compact.length <= limit) {
    return compact;
  }

  return `${compact.slice(0, limit - 3)}...`;
}

function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildFetchUrl(rawUrl) {
  const parsedUrl = new URL(rawUrl);

  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    throw new Error("url must use http or https.");
  }

  return `https://r.jina.ai/${parsedUrl.toString()}`;
}

function deriveSuggestedTitle(rawUrl, content) {
  const meaningfulLine = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line && !/^https?:\/\//i.test(line));

  if (meaningfulLine) {
    const cleaned = meaningfulLine
      .replace(/^#+\s*/, "")
      .replace(/^(Title|URL Source|Markdown Content):\s*/i, "")
      .replace(/\s+/g, " ")
      .trim();

    if (cleaned.length >= 3) {
      return cleaned.slice(0, 120);
    }
  }

  const parsedUrl = new URL(rawUrl);
  const tail = parsedUrl.pathname === "/" ? "" : parsedUrl.pathname.replace(/\/$/, "").split("/").pop() || "";
  const label = tail ? `${parsedUrl.hostname} ${tail}` : parsedUrl.hostname;

  return `Web Capture ${label}`.slice(0, 120);
}

function buildNoteBody({ noteTitle, sourceUrl, fetchUrl, content }) {
  return [
    "<div>",
    `<p><strong>${escapeHtml(noteTitle)}</strong></p>`,
    `<p><strong>Source URL:</strong> <a href="${escapeHtml(sourceUrl)}">${escapeHtml(sourceUrl)}</a></p>`,
    `<p><strong>Fetched Via:</strong> <a href="${escapeHtml(fetchUrl)}">${escapeHtml(fetchUrl)}</a></p>`,
    `<pre>${escapeHtml(content)}</pre>`,
    "</div>"
  ].join("");
}

function buildBaseResult({
  sourceUrl,
  fetchUrl,
  noteTitle,
  accountName,
  folderName,
  noteCreated,
  noteId,
  content
}) {
  return {
    source_url: sourceUrl,
    fetch_url: fetchUrl,
    note_title: noteTitle,
    account_name: accountName || "default",
    folder_name: folderName || "Notes",
    note_created: noteCreated,
    note_id: noteId,
    content_length: content.length,
    content_preview: previewText(content)
  };
}

async function fetchWebContent({ input }) {
  const sourceUrl = requireString(input.url, "url");
  const fetchUrl = buildFetchUrl(sourceUrl);

  let stdout;

  try {
    ({ stdout } = await execFileAsync("curl", ["-fsSL", fetchUrl], {
      maxBuffer: MAX_BUFFER_BYTES
    }));
  } catch (error) {
    const details = [error.message, error.stderr].filter(Boolean).join(" ").trim();
    throw new Error(`curl failed for ${fetchUrl}. ${details}`);
  }

  const content = stdout.trim();

  if (!content) {
    throw new Error(`curl returned empty content for ${fetchUrl}.`);
  }

  return {
    url: sourceUrl,
    fetch_url: fetchUrl,
    content,
    content_length: content.length,
    content_preview: previewText(content),
    suggested_title: deriveSuggestedTitle(sourceUrl, content)
  };
}

async function createAppleNote({ input }) {
  const request = input.request ?? {};
  const fetchResult = input.fetch_result ?? {};
  const sourceUrl = requireString(request.url ?? fetchResult.url, "request.url");
  const fetchUrl = requireString(fetchResult.fetch_url, "fetch_result.fetch_url");
  const content = requireString(fetchResult.content, "fetch_result.content");
  const preferredAccountName = optionalString(request.account_name);
  const preferredFolderName = optionalString(request.folder_name);
  const noteTitle =
    optionalString(request.note_title) ||
    optionalString(fetchResult.suggested_title) ||
    deriveSuggestedTitle(sourceUrl, content);
  const dryRun = request.dry_run === true;
  const baseResult = buildBaseResult({
    sourceUrl,
    fetchUrl,
    noteTitle,
    accountName: preferredAccountName,
    folderName: preferredFolderName,
    noteCreated: false,
    noteId: "",
    content
  });

  if (dryRun) {
    return baseResult;
  }

  const noteBody = buildNoteBody({
    noteTitle,
    sourceUrl,
    fetchUrl,
    content
  });
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "capture-link-note-"));
  const noteBodyPath = path.join(tempDir, "note-body.html");
  const appleScript = `
on run argv
  set noteTitle to item 1 of argv
  set bodyPath to item 2 of argv
  set preferredAccountName to item 3 of argv
  set preferredFolderName to item 4 of argv

  set noteBody to read POSIX file bodyPath as «class utf8»

  tell application "Notes"
    if not running then launch

    set targetAccount to missing value
    if preferredAccountName is not "" then
      try
        set targetAccount to first account whose name is preferredAccountName
      end try
    end if
    if targetAccount is missing value then set targetAccount to first account

    set targetFolder to missing value
    if preferredFolderName is not "" then
      try
        set targetFolder to first folder of targetAccount whose name is preferredFolderName
      end try
    end if
    if targetFolder is missing value then
      try
        set targetFolder to first folder of targetAccount whose name is "Notes"
      end try
    end if
    if targetFolder is missing value then set targetFolder to first folder of targetAccount

    tell targetFolder
      set newNote to make new note with properties {name:noteTitle, body:noteBody}
    end tell

    return (id of newNote as string) & linefeed & (name of targetAccount) & linefeed & (name of targetFolder)
  end tell
end run`.trim();

  try {
    await writeFile(noteBodyPath, noteBody, "utf8");

    const { stdout } = await execFileAsync(
      "osascript",
      ["-l", "AppleScript", "-e", appleScript, noteTitle, noteBodyPath, preferredAccountName, preferredFolderName],
      {
        maxBuffer: MAX_BUFFER_BYTES
      }
    );
    const [noteId = "", resolvedAccountName = "", resolvedFolderName = ""] = stdout.trim().split(/\r?\n/);

    return buildBaseResult({
      sourceUrl,
      fetchUrl,
      noteTitle,
      accountName: resolvedAccountName || preferredAccountName,
      folderName: resolvedFolderName || preferredFolderName,
      noteCreated: true,
      noteId: noteId.trim(),
      content
    });
  } catch (error) {
    const details = [error.message, error.stderr].filter(Boolean).join(" ").trim();
    throw new Error(
      `osascript failed while creating the Apple Note. Ensure Notes is available and automation permission is granted. ${details}`
    );
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

export const primitiveHandlers = {};

registerPrimitive(primitiveHandlers, SKILL_ID, "web.fetch-content", fetchWebContent);
registerPrimitive(primitiveHandlers, SKILL_ID, "notes.create-note", createAppleNote);
