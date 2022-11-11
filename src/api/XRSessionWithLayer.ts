/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import type {
	XRFrameRequestCallback,
	XRRenderState,
	XRSession,
	XRSessionMode,
	XRWebGLLayer,
	XRFrame,
	XRReferenceSpace,
	XRView,
	XRSpace,
} from 'webxr'
import { XRTextureType, XRWebGLRenderingContext } from '../types'
import XRCompositionLayerPolyfill from './XRCompositionLayerPolyfill'
import XRProjectionLayer from './XRProjectionLayer'
import { createProjectionRenderer } from '../gl/projection-renderer'
import XRQuadLayer from './XRQuadLayer'
import { QuadRenderer } from '../gl/quad-renderer'
import XRCylinderLayer from './XRCylinderLayer'
import { CylinderRenderer } from '../gl/cylinder-renderer'
import { LayerRenderer } from '../gl/base-renderer'
import XREquirectLayer from './XREquirectLayer'
import { EquirectRenderer } from '../gl/equirect-renderer'
import XRCubeLayer from './XRCubeLayer'
import { CubeRenderer } from '../gl/cube-renderer'
import { getGlobal } from '../utils/get-global'

interface XRRenderStateWithLayer extends XRRenderState {
	layers?: (XRCompositionLayerPolyfill | XRWebGLLayer)[]
}

// type here to avoid trying to include XRWebGLLayer from the webxr package
// because XRWebGLLayer was defined as a class, not an interface.

export class XRSessionWithLayer {
	public mode: XRSessionMode = 'inline'
	protected activeRenderState: XRRenderStateWithLayer
	protected internalLayer: XRWebGLLayer
	protected existingBaseLayer: XRWebGLLayer
	protected layers: (XRCompositionLayerPolyfill | XRWebGLLayer)[] = []
	protected context: XRWebGLRenderingContext

	protected injectedFrameCallback: XRFrameRequestCallback
	protected referenceSpace: XRReferenceSpace
	protected viewerSpace: XRReferenceSpace
	protected views: XRView[] = []

	private initializedViews: boolean = false
	private isPolyfillActive: boolean = false

	// RENDERERS
	private renderers: WeakMap<XRCompositionLayerPolyfill, LayerRenderer>

	private tempFramebuffer: WebGLFramebuffer

	// TASK QUEUE
	private taskQueue: (() => void)[] = []

	constructor() {}

	requestAnimationFrame(animationFrameCallback: XRFrameRequestCallback) {
		// if we don't have a pose, get the pose
		if (!this.injectedFrameCallback) {
			this.injectedFrameCallback = (time: number, frame: XRFrame) => {
				let gl = this.context

				if (!this.initializedViews && this.referenceSpace) {
					let pose = frame.getViewerPose(this.referenceSpace)
					if (pose) {
						this.views = pose.views
						this.initializedViews = true
					}
				}

				// Layers MUST be cleared to (0, 0, 0, 0) at the beginning of the frame
				if (this.isPolyfillActive && this.initializedViews) {
					if (!this.tempFramebuffer) {
						this.tempFramebuffer = gl.createFramebuffer()
					}

					gl.bindFramebuffer(gl.FRAMEBUFFER, this.tempFramebuffer)
					const existingClearColor = gl.getParameter(gl.COLOR_CLEAR_VALUE)
					const existingFrameBuffer = gl.getParameter(gl.FRAMEBUFFER_BINDING)

					gl.clearColor(0, 0, 0, 0)
					for (let layer of this.layers) {
						// TODO: spec says all of them should be cleared, but clearing quad layers causes the layer
						// to disappear...
						if (!(layer instanceof XRProjectionLayer)) {
							continue
						}
						// clear color textures
						for (let i = 0; i < layer.colorTextures.length; i++) {
							let textureType: XRTextureType = layer.colorTexturesMeta[i].type

							if (textureType === XRTextureType['texture-array']) {
								// TODO: figure out what to do for texture arrays
								// unsupported
							} else {
								gl.framebufferTexture2D(
									gl.FRAMEBUFFER,
									gl.COLOR_ATTACHMENT0,
									gl.TEXTURE_2D,
									layer.colorTextures[i],
									0
								)
								if (layer.depthStencilTextures && i < layer.depthStencilTextures.length) {
									gl.framebufferTexture2D(
										gl.FRAMEBUFFER,
										gl.DEPTH_ATTACHMENT,
										gl.TEXTURE_2D,
										layer.depthStencilTextures[i],
										0
									)
								} else {
									gl.framebufferTexture2D(
										gl.FRAMEBUFFER,
										gl.DEPTH_ATTACHMENT,
										gl.TEXTURE_2D,
										null,
										0
									)
								}
								gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
							}
						}
					}

					// set framebuffer back before rendering anything
					gl.bindFramebuffer(gl.FRAMEBUFFER, existingFrameBuffer)
					gl.clearColor(
						existingClearColor[0],
						existingClearColor[1],
						existingClearColor[2],
						existingClearColor[3]
					)
				}

				animationFrameCallback(time, frame)

				// render the layers
				if (this.isPolyfillActive && this.initializedViews) {
					// store values so we can reset it after our rendering pass.
					let prevBlend = gl.isEnabled(gl.BLEND)
					let prevDepthTest = gl.isEnabled(gl.DEPTH_TEST)
					let prevCullFace = gl.isEnabled(gl.CULL_FACE)

					const existingFrameBuffer = gl.getParameter(gl.FRAMEBUFFER_BINDING)
					const existingClearColor = gl.getParameter(gl.COLOR_CLEAR_VALUE)
					gl.bindFramebuffer(gl.FRAMEBUFFER, this.getBaseLayer().framebuffer)

					gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
					gl.clearColor(
						existingClearColor[0],
						existingClearColor[1],
						existingClearColor[2],
						existingClearColor[3]
					)

					// you need to enable gl.BLEND for the
					// blend function to operate. And for alpha to multiply.
					gl.enable(gl.BLEND)
					gl.disable(gl.DEPTH_TEST)
					gl.disable(gl.CULL_FACE)

					let prevBlendSrcRGB = gl.getParameter(gl.BLEND_SRC_RGB)
					let prevBlendSrcAlpha = gl.getParameter(gl.BLEND_SRC_ALPHA)
					let prevBlendDestRGB = gl.getParameter(gl.BLEND_DST_RGB)
					let prevBlendDestAlpha = gl.getParameter(gl.BLEND_DST_ALPHA)
					gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)

					// get all layers!
					for (let layer of this.layers) {
						if (!this.renderers) {
							this.renderers = new WeakMap()
						}

						// if it's not a media layer, we need to render a normal WebGL Layer
						// which involves using custom shaders per layer type.
						if (layer instanceof XRProjectionLayer) {
							if (!this.renderers.has(layer)) {
								this.renderers.set(layer, createProjectionRenderer(layer, this.context))
							}

							const renderer = this.renderers.get(layer)
							renderer.render(this)
						} else if (layer instanceof XRQuadLayer) {
							if (!this.renderers.has(layer)) {
								this.renderers.set(layer, new QuadRenderer(layer, this.context))
							}

							const renderer = this.renderers.get(layer)
							renderer.render(this, frame)
						} else if (layer instanceof XRCylinderLayer) {
							if (!this.renderers.has(layer)) {
								this.renderers.set(layer, new CylinderRenderer(layer, this.context))
							}

							const renderer = this.renderers.get(layer)
							renderer.render(this, frame)
						} else if (layer instanceof XREquirectLayer) {
							if (!this.renderers.has(layer)) {
								this.renderers.set(layer, new EquirectRenderer(layer, this.context))
							}

							const renderer = this.renderers.get(layer)
							renderer.render(this, frame)
						} else if (layer instanceof XRCubeLayer) {
							if (!this.renderers.has(layer)) {
								this.renderers.set(layer, new CubeRenderer(layer, this.context))
							}

							const renderer = this.renderers.get(layer)
							renderer.render(this, frame)
						} else {
							// XRWebGLLayer
							const webglLayer = layer as XRWebGLLayer
							if (webglLayer.framebuffer === null) {
								// webglLayer is the same as the base layer, so we skip it since
								// we rendered into the framebuffer already.
								continue
							}

							// TODO: test this, because this is totally untested.
							if (gl instanceof WebGL2RenderingContext) {
								gl.bindFramebuffer(gl.READ_FRAMEBUFFER, webglLayer.framebuffer)
								gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, this.getBaseLayer().framebuffer)
								gl.blitFramebuffer(
									0,
									0,
									webglLayer.framebufferWidth,
									webglLayer.framebufferHeight,
									0,
									0,
									this.getBaseLayer().framebufferWidth,
									this.getBaseLayer().framebufferHeight,
									gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT,
									gl.LINEAR
								)
							} else {
								console.warn(
									'GL blitFramebuffer is not supported on WebGL1, so XRWebGLLayers may not show up properly when polyfilled.'
								)
							}
						}
					}

					// restore previous settings
					if (!prevBlend) {
						gl.disable(gl.BLEND)
					}

					if (prevDepthTest) {
						gl.enable(gl.DEPTH_TEST)
					}

					if (prevCullFace) {
						gl.enable(gl.CULL_FACE)
					}

					// restore previous blendFunc
					gl.blendFuncSeparate(
						prevBlendSrcRGB,
						prevBlendDestRGB,
						prevBlendSrcAlpha,
						prevBlendDestAlpha
					)

					gl.bindFramebuffer(gl.FRAMEBUFFER, existingFrameBuffer)

					// run task queue
					while (this.taskQueue.length > 0) {
						const task = this.taskQueue.shift()
						task()
					}
				}
			}
		}

		;(this as any)._requestAnimationFrame(this.injectedFrameCallback)
	}

	// An implementation of session.updateRenderState({ layers: [...layers] });
	// that overrides layers and sets the baseLayer to one that is custom created in this
	// polyfilled session, and then adds the contents of the other layers onto that base layer
	// and saves the custom layers as state on the object
	public updateRenderState(XRRenderStateInit: XRRenderStateWithLayer): void {
		this.existingBaseLayer = XRRenderStateInit.baseLayer

		if (XRRenderStateInit.layers) {
			this.layers = XRRenderStateInit.layers
		}

		if (!this.activeRenderState) {
			this.createActiveRenderState()
		}

		this.activeRenderState = { ...this.activeRenderState, ...XRRenderStateInit }

		if (!XRRenderStateInit.layers) {
			// no layer information in this renderState, so we don't need to update
			// context or the renderState object before passing it to the underlying
			// updateRenderState function.
			;(this as any)._updateRenderState(XRRenderStateInit)
			return
		}

		let layerRenderStateInit = Object.assign({}, XRRenderStateInit)
		delete layerRenderStateInit.layers

		let context = undefined

		for (let layer of this.layers) {
			if (layer instanceof XRCompositionLayerPolyfill) {
				context = layer.getContext()
				break
			}
		}

		if (!context && !this.context) {
			console.log('No existing context! Have the session make one')
			const canvas = document.createElement('canvas')
			context = canvas.getContext('webgl2', { xrCompatible: true })
			if (!context) {
				// fallback to webgl 1 if 2 is not supported.
				// the session only creates the context if there are only
				// media layers, so this should work regardless.
				context = canvas.getContext('webgl', { xrCompatible: true })
			}

			if (!context) {
				// we don't support webGL at all...this is a failure case.
				// though, we probably should've errored out long before reaching this.
				throw new Error('No webGL support detected.')
			}
			document.body.appendChild(context.canvas)

			// TODO: Figure out if we actually need to resize the canvas.
			function onResize() {
				context.canvas.width = context.canvas.clientWidth * window.devicePixelRatio
				context.canvas.height = context.canvas.clientHeight * window.devicePixelRatio
			}
			window.addEventListener('resize', onResize)
			onResize()
		}

		this.createInternalLayer(context)
		this.isPolyfillActive = true

		// add the internal layer as the base layer
		;(this as any)._updateRenderState({
			...layerRenderStateInit,
			baseLayer: this.internalLayer,
		})
	}

	// POLYFILL SPECIFIC

	// called on requestSession to make sure polyfilled XRSession has
	// access to some assumed default views.
	public initializeSession(mode: XRSessionMode) {
		this.mode = mode

		// temporary reference space to grab views
		;(this as any)
			.requestReferenceSpace('local')
			.then((refSpace) => {
				this.referenceSpace = refSpace
			})
			.catch((e) => {
				// do nothing.
			})
		;(this as any).requestReferenceSpace('viewer').then((viewerSpace) => {
			this.viewerSpace = viewerSpace
		})
	}

	public getBaseLayer(context?: XRWebGLRenderingContext): XRWebGLLayer {
		if (!this.internalLayer && !this.existingBaseLayer && context) {
			// TODO: this might be buggy if the context has changed...
			this.createInternalLayer(context)
		}
		return this.internalLayer || this.existingBaseLayer
	}

	public getReferenceSpace(): XRReferenceSpace {
		return !this.referenceSpace ? this.viewerSpace : this.referenceSpace
	}

	public getViewerSpace() {
		return this.viewerSpace
	}

	public queueTask(task: () => void) {
		this.taskQueue.push(task)
	}

	get renderState() {
		if (!this.activeRenderState) {
			this.createActiveRenderState()
		}
		return this.activeRenderState
	}

	get internalViews() {
		return this.views
	}

	public getViewIndex(view: XRView): number {
		for (let i = 0; i < this.views.length; i++) {
			let testView = this.views[i]
			if (
				view.eye === testView.eye &&
				view.recommendedViewportScale === testView.recommendedViewportScale
			) {
				return i
			}
		}

		return -1
	}

	protected createInternalLayer(context?: XRWebGLRenderingContext) {
		if (!context && this.internalLayer) {
			return this.internalLayer
		}
		if (context === this.context && this.internalLayer) {
			return this.internalLayer
		}

		const _global = getGlobal()
		this.internalLayer = new _global.XRWebGLLayer((this as unknown) as XRSession, context)
		this.setContext(context)
		return this.internalLayer
	}

	protected setContext(context: XRWebGLRenderingContext) {
		// reset everything that depends on context
		this.context = context
		this.tempFramebuffer = context.createFramebuffer()
		this.renderers = new WeakMap()
	}

	protected createActiveRenderState() {
		// this code ensures that we return an object that follows the interface for XRRenderState
		// with the layers array added, regardless of whether we're on device or in emulator
		// since sometimes XRRenderState is a native object, and other times it's a symbol, and
		// other times defined as a plain JS object.
		const _global = getGlobal()
		let prototypeNames = Object.getOwnPropertyNames(_global.XRRenderState.prototype)
		const renderStateClone: any = {}
		for (let item of prototypeNames) {
			renderStateClone[item] = (this as any)._renderState[item]
		}
		renderStateClone.layers = []
		this.activeRenderState = renderStateClone
	}
}
