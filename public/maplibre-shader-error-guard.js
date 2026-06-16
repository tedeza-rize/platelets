(() => {
  const emptyFragmentShaderError = "Could not compile fragment shader: ";
  window.addEventListener(
    "error",
    (event) => {
      const errorMessage =
        event.error && typeof event.error.message === "string"
          ? event.error.message
          : "";

      if (
        event.message !== emptyFragmentShaderError &&
        errorMessage !== emptyFragmentShaderError
      ) {
        return;
      }

      event.preventDefault();
      event.stopImmediatePropagation();
    },
    true,
  );
})();
