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

import { XRViewportPolyfill, XRWebGLSubImage } from '../types'

export default class XRWebGLSubImagePolyfill implements XRWebGLSubImage {
	public colorTexture: WebGLTexture
	public depthStencilTexture?: WebGLTexture
	public imageIndex?: number
	public textureWidth: number
	public textureHeight: number
	public viewport: XRViewportPolyfill

	constructor() {
		this.viewport = {
			x: 0,
			y: 0,
			width: 0,
			height: 0,
		}
	}
}
