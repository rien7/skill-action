function registerPrimitive(handlers, skillId, actionId, handler) {
  handlers[actionId] = handler;
  handlers[JSON.stringify([skillId, actionId])] = handler;
}

export const primitiveHandlers = {};

registerPrimitive(
  primitiveHandlers,
  "my.skill",
  "helper.step",
  async ({ input }) => {
    return {
      value: input.value
    };
  }
);
