const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
    entry: {
        bundle: [ './src/bpmninvest.mjs' ]
    },
    output: {
        path: __dirname + '/public',
        filename: 'bpmninvest.mjs'
    },
    module: {
        rules: [
            {
                test: /\.css$/,
                use: [
                    'style-loader',
                    'css-loader'
                ]
            },
            {
                test: /\.bpmn$/,
                use: 'raw-loader'
            },
            {
                test: /\.png$/,
                use: {
                    loader: 'url-loader'
                }
            },
            {
                test: /\.m?js/, // fix:issue: https://github.com/webpack/webpack/issues/11467
                resolve: {
                    fullySpecified: false,
                }
            }
        ]
    },
    plugins: [
        new CopyWebpackPlugin({
            patterns: [
                { from: './src/index.html', to: '.' }
            ]
        })
    ],
    mode: 'development',
    devtool: 'source-map'
};