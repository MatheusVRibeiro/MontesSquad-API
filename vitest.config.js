const { defineConfig } = require("vitest/config");

module.exports = defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.js"],
    exclude: [
      "**/node_modules/**",
      "test/github.*.test.js",
      "test/githubPrivacy*.test.js",
      "test/reputacaoTecnica*.test.js",
      "test/portfolio*.test.js",
    ],
    testTimeout: 15000,
    hookTimeout: 15000,
  },
});
