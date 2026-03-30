export const globalActions = [
  {
    action_id: "cli://math/add-one",
    version: "1.0.0",
    kind: "primitive",
    title: "Global Add One",
    description: "Increment a number through a global CLI-style action",
    input_schema: {
      type: "object",
      properties: {
        value: {
          type: "number"
        }
      },
      required: ["value"],
      additionalProperties: false
    },
    output_schema: {
      type: "object",
      properties: {
        value: {
          type: "number"
        }
      },
      required: ["value"],
      additionalProperties: false
    },
    visibility: "public",
    side_effect: "none",
    idempotent: true
  }
];

export const primitiveHandlers = {
  "math.add-one": ({ input }) => {
    return {
      value: input.value + 1
    };
  },
  "cli://math/add-one": ({ input }) => {
    return {
      value: input.value + 1
    };
  }
};
