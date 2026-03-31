export const primitiveHandlers = {
  "[\"sample.skill\",\"math.add-one\"]": ({ input }) => {
    return {
      value: input.value + 1
    };
  }
};
