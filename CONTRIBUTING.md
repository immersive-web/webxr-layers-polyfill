## Developing

The WebXR Layers Polyfill is developed in Typescript, and uses `npm` as its package manager.

```bash
$ git clone git@github.com:immersive-web/webxr-layers-polyfill.git
$ cd webxr-layers-polyfill

# Install dependencies
$ npm install

# Build transpiled ES5 script
$ npm run build-script

# Build ES module
$ npm run build-module

# Create all builds
$ npm run build

# Run tests
$ npm test
```

### Testing

This project uses `Jest` to run unit tests, and there's a small collection of them in the `/tests` folder. Unfortunately, it's difficult to make immersive WebXR sessions within a unit test setting, so the current existing tests mostly check to make sure the program polyfills the required classes.

Run the unit tests via:

```
$ npm test
```

Please also test the examples with your changes where appropriate. To run the examples, build the polyfill and run

```
$ npm run serve
```

and point your web browser to `http://localhost:8080/examples/layers-samples/`.

### Submitting a Pull Request

We actively welcome pull requests.

1. Fork the repo and create your branch from `main`.
2. If you've added code that should be tested, add tests. (This is unlikely, unless you're modifying the shape of the polyfilled classes.)
3. Ensure the test suite passes, and that you've checked your changes manually against the examples.
4. Format your code.

This project uses `Prettier` to format the source code. Please run the formatter with

```
$ npm run format
```

before submitting your changes.

## License

This program is free software for both commercial and non-commercial use, distributed under the Apache 2.0 license, which can be found in the LICENSE file.
