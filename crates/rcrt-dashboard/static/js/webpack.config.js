const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';
  
  return {
    entry: {
      dashboard: './dashboard-main.js',
    },
    
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: isProduction ? '[name]-bundle.[contenthash].js' : '[name]-bundle.js',
      chunkFilename: isProduction ? '[name].[contenthash].js' : '[name].js',
      clean: true,
      publicPath: '/static/js/dist/',
    },
    
    module: {
      rules: [
        {
          test: /\.js$/,
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader',
            options: {
              presets: ['@babel/preset-env'],
              plugins: ['@babel/plugin-syntax-dynamic-import']
            }
          }
        },
        {
          test: /\.css$/,
          use: [
            isProduction ? MiniCssExtractPlugin.loader : 'style-loader',
            'css-loader'
          ]
        },
        {
          test: /\.(png|jpg|gif|svg)$/,
          type: 'asset/resource',
          generator: {
            filename: 'assets/[name].[contenthash][ext]'
          }
        }
      ]
    },
    
    plugins: [
      ...(isProduction ? [
        new MiniCssExtractPlugin({
          filename: '[name].[contenthash].css'
        })
      ] : []),
      
      // Generate HTML with correct script tags
      new HtmlWebpackPlugin({
        template: '../index.html',
        filename: 'index.html',
        inject: 'body',
        chunks: ['dashboard'],
        templateParameters: {
          // Pass any template variables needed
          title: 'RCRT Dashboard - Production Build'
        }
      })
    ],
    
    optimization: {
      splitChunks: {
        chunks: 'all',
        cacheGroups: {
          // Three.js in separate chunk
          three: {
            test: /[\\/]node_modules[\\/]three[\\/]/,
            name: 'three',
            chunks: 'all',
            priority: 20
          },
          // Vendor dependencies
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendor',
            chunks: 'all',
            priority: 10
          },
          // Dashboard core modules
          core: {
            test: /[\\/]modules[\\/](state|api-client|canvas-engine)\.js$/,
            name: 'core',
            chunks: 'all',
            priority: 15
          },
          // Dashboard feature modules (lazy loaded)
          features: {
            test: /[\\/]modules[\\/](3d-engine|admin-manager|chat-manager)\.js$/,
            name: 'features',
            chunks: 'async',
            priority: 5
          }
        }
      },
      
      // Runtime chunk for better caching
      runtimeChunk: 'single'
    },
    
    resolve: {
      extensions: ['.js', '.json'],
      alias: {
        '@': path.resolve(__dirname, 'modules'),
        '@state': path.resolve(__dirname, 'modules/state.js'),
        '@api': path.resolve(__dirname, 'modules/api-client.js')
      }
    },
    
    devServer: {
      static: {
        directory: path.join(__dirname, '../'),
        publicPath: '/static/'
      },
      port: 8080,
      hot: true,
      open: true,
      historyApiFallback: {
        index: '/static/js/dist/index.html'
      },
      proxy: {
        '/api': {
          target: 'http://localhost:8081',
          changeOrigin: true,
          secure: false
        }
      }
    },
    
    devtool: isProduction ? 'source-map' : 'eval-cheap-module-source-map',
    
    // Performance hints
    performance: {
      hints: isProduction ? 'warning' : false,
      maxAssetSize: 512000, // 500kb
      maxEntrypointSize: 512000 // 500kb
    },
    
    stats: {
      colors: true,
      modules: false,
      chunks: false,
      chunkModules: false,
      entrypoints: false
    }
  };
};
