# webxr-layers-polyfill

A Javascript implementation of the [WebXR Layers API](https://www.w3.org/TR/webxrlayers-1/), which renders layers in WebGL.

This polyfill _only_ polyfills the Layers API; use the [WebXR Polyfill](https://github.com/immersive-web/webxr-polyfill) to polyfill other WebXR features.

## Setup

Download the polyfill from `build/webxr-layers-polyfill.js` and include it as a script tag.

```html
<script src="webxr-layers-polyfill.js"></script>
```

Then, you will need to instantiate the polyfill in code before calling any XR code:

```js
let layersPolyfill = new WebXRLayersPolyfill()
```

## Building

The polyfill is written in `Typescript` and bundled with `Rollup`. Build with

```bash
$ npm run build
```

To run the examples, create a build, then run:

```bash
$ npm run serve
```

and point your web browser to `http://localhost:8080/examples/layers-samples/`.

## What does it do?

The polyfill provides polyfilled classes for the new layer types defined in the WebXR Layers API, and modifies XRSession to use those polyfilled classes. The layers provide the `WebGLTexture`s that the application renders into, then the polyfilled XRSession renders those layers onto an internal `baseLayer`. This baseLayer is then displayed in headset, in the same way that an XRSession without layers support would render it.

## Not Supported

- `onredraw` events for `XRCubeLayer`, `XRCylinderLayer`, `XREquirectLayer`, and `XRQuadLayer` are not implemented.
- `mipLevels` - the polyfill ignores them, and assumes all layers are created without mipmaps.
- Secondary views on `XRProjectionLayer` are ignored.

## License

This program is free software for both commercial and non-commercial use, distributed under the Apache 2.0 license, which can be found in the LICENSE file.
