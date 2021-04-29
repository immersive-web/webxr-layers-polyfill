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
	XRLayer,
	XRViewport,
	XRSpace,
	XRSession,
	XRView,
	XRWebGLLayer,
	XRSessionMode,
	XRRigidTransform,
} from 'webxr'

export enum XRTextureType {
	'texture' = 'texture',
	'texture-array' = 'texture-array',
}

export type XRWebGLRenderingContext = WebGLRenderingContext | WebGL2RenderingContext

export enum XRLayerLayout {
	'default' = 'default',
	'mono' = 'mono',
	'stereo' = 'stereo',
	'stereo-left-right' = 'stereo-left-right',
	'stereo-top-bottom' = 'stereo-top-bottom',
}

export type XRLayerInit = {
	space: XRSpace
	colorFormat: GLenum
	depthFormat?: GLenum
	mipLevels: number
	viewPixelWidth: number
	viewPixelHeight: number
	layout: XRLayerLayout
	isStatic: boolean
}

export type XRProjectionLayerInit = {
	textureType: XRTextureType
	colorFormat: GLenum
	depthFormat: GLenum
	scaleFactor: number
}

export type XRQuadLayerInit = XRLayerInit & {
	textureType: XRTextureType
	transform?: XRRigidTransform
	width: number
	height: number
}

export type XRCylinderLayerInit = XRLayerInit & {
	textureType: XRTextureType
	transform?: XRRigidTransform
	radius: number
	centralAngle: number
	aspectRatio: 2.0
}

export type XREquirectLayerInit = XRLayerInit & {
	textureType: XRTextureType
	transform?: XRRigidTransform
	radius: number
	centralHorizontalAngle: number
	upperVerticalAngle: number
	lowerVerticalAngle: number
}

export type XRCubeLayerInit = XRLayerInit & {
	orientation?: DOMPointReadOnly
}

export type XRMediaLayerInit = {
	space: XRSpace
	layout: XRLayerLayout
	invertStereo: boolean
}

export type XRMediaQuadLayerInit = XRMediaLayerInit & {
	transform?: XRRigidTransform
	width?: number
	height?: number
}

export type XRMediaCylinderLayerInit = XRMediaLayerInit & {
	transform?: XRRigidTransform
	radius: number
	centralAngle: number
	aspectRatio?: number
}

export type XRMediaEquirectLayerInit = XRMediaLayerInit & {
	transform?: XRRigidTransform
	radius: number
	centralHorizontalAngle: number
	upperVerticalAngle: number
	lowerVerticalAngle: number
}

export interface XRCompositionLayer extends XRLayer {
	readonly layout: XRLayerLayout

	colorTextures: WebGLTexture[]
	depthStencilTextures: WebGLTexture[]

	blendTextureSourceAlpha: boolean
	chromaticAberrationCorrection?: boolean
	readonly mipLevels: number
	readonly needsRedraw: boolean
	destroy(): void
}

export interface XRSubImage {
	readonly viewport: XRViewport
}

export interface XRWebGLSubImage extends XRSubImage {
	readonly colorTexture: WebGLTexture
	readonly depthStencilTexture?: WebGLTexture
	readonly imageIndex?: number
	readonly textureWidth: number
	readonly textureHeight: number
}

export type PolyfillTexture = {
	texture: WebGLTexture
	textureFormat: GLenum
	width: number
	height: number
	layers?: number
	type: XRTextureType
}

// NOTE: used so we can actually edit the values when
// setting the viewport...
export interface XRViewportPolyfill {
	x: number
	y: number
	width: number
	height: number
}

export interface XRSessionPolyfill extends XRSession {
	mode: XRSessionMode
	internalViews: XRView[]
	initializeSession(mode: XRSessionMode): void
	getBaseLayer(context?: XRWebGLRenderingContext): XRWebGLLayer
	getViewIndex(view: XRView): number
	queueTask(task: () => void): void
}
