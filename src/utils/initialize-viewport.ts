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

import { PolyfillTexture, XRLayerLayout, XRViewportPolyfill } from '../types'

export const initializeViewport = (
	viewport: XRViewportPolyfill,
	texture: PolyfillTexture,
	layout: XRLayerLayout,
	offset: number,
	numViews: number
): void => {
	let x = 0
	let y = 0
	let width = texture.width
	let height = texture.height

	// If layout is "stereo-left-right":
	// Set viewport’s x to the pixel width of texture multiplied by offset and divided by num.
	// Set viewport’s width to the pixel width of subimage’s texture divided by num.
	if (layout === XRLayerLayout['stereo-left-right']) {
		x = (texture.width * offset) / numViews
		width = texture.width / numViews
	} else if (layout === XRLayerLayout['stereo-top-bottom']) {
		// Set viewport’s y to the pixel height of texture multiplied by offset and divided by num.
		// Set viewport’s height to the pixel height of subimage’s texture divided by num.
		y = (texture.height * offset) / numViews
		height = texture.height / numViews
	}

	viewport.x = x
	viewport.y = y
	viewport.width = width
	viewport.height = height
}
