const path = require("path");
module.exports = {
  title: "Graph Apps Kit Playground",
  showCode: true,
  showUsage: false,
  sections: [
    {
      name: "Playground intro",
      content: "docs/introduction.md"
    },
    {
      name: "Components",
      components: "src/**/[A-Z]*.js"
    }
  ],
  webpackConfig: {
    module: {
      rules: [
        // Babel loader, will use your project’s .babelrc
        {
          test: /\.jsx?$/,
          exclude: /node_modules/,
          loader: "babel-loader"
        },
        {
          test: /\.css$/,
          loader: "file-loader"
        }
      ]
    }
  },
  require: [path.resolve(__dirname, "config/styleguide.setup.js")]
};
