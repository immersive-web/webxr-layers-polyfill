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

/**
 * In WebGL2, internalFormat and format no longer need to be the same, but
 * must be defined very specifically. This is a helper utility that, given a sized or unsized format,
 * returns both formats as well as the type for that format.
 * See https://registry.khronos.org/webgl/specs/latest/2.0/#TEXTURE_TYPES_FORMATS_FROM_DOM_ELEMENTS_TABLE
 * or https://webgl2fundamentals.org/webgl/lessons/webgl-data-textures.html for more information.
 *
 * @param context WebGL2 Rendering context used for the enums
 * @param providedFormat The provided format (sized or unsized) to retrieve other formats for
 * @returns
 */
export const getFormatsFromInternalFormat = (
	context: WebGL2RenderingContext,
	providedFormat: GLenum
): {
	internalFormat: GLenum
	textureFormat: GLenum
	type: GLenum
} => {
	switch (providedFormat) {
		case context.RGBA8:
		case context.RGB5_A1:
		case context.RGBA4:
		case context.SRGB8_ALPHA8:
			return {
				internalFormat: providedFormat,
				textureFormat: context.RGBA,
				type: context.UNSIGNED_BYTE,
			}
		case context.RGBA8_SNORM:
			return {
				internalFormat: providedFormat,
				textureFormat: context.RGBA,
				type: context.BYTE,
			}
		case context.RGB10_A2:
			return {
				internalFormat: providedFormat,
				textureFormat: context.RGBA,
				type: context.UNSIGNED_INT_2_10_10_10_REV,
			}
		case context.RGBA16F:
			return {
				internalFormat: providedFormat,
				textureFormat: context.RGBA,
				type: context.HALF_FLOAT,
			}
		case context.RGBA32F:
			return {
				internalFormat: providedFormat,
				textureFormat: context.RGBA,
				type: context.FLOAT,
			}
		case context.RGBA8UI:
			return {
				internalFormat: providedFormat,
				textureFormat: context.RGBA_INTEGER,
				type: context.UNSIGNED_BYTE,
			}
		case context.RGBA8I:
			return {
				internalFormat: providedFormat,
				textureFormat: context.RGBA_INTEGER,
				type: context.BYTE,
			}
		case context.RGBA16UI:
			return {
				internalFormat: providedFormat,
				textureFormat: context.RGBA_INTEGER,
				type: context.UNSIGNED_SHORT,
			}
		case context.RGBA16I:
			return {
				internalFormat: providedFormat,
				textureFormat: context.RGBA_INTEGER,
				type: context.SHORT,
			}
		case context.RGBA32UI:
			return {
				internalFormat: providedFormat,
				textureFormat: context.RGBA_INTEGER,
				type: context.UNSIGNED_INT,
			}
		case context.RGBA32I:
			return {
				internalFormat: providedFormat,
				textureFormat: context.RGBA_INTEGER,
				type: context.INT,
			}
		case context.RGB10_A2UI:
			return {
				internalFormat: providedFormat,
				textureFormat: context.RGBA_INTEGER,
				type: context.UNSIGNED_INT_2_10_10_10_REV,
			}
		case context.RGB8:
		case context.RGB565:
		case context.SRGB8:
			return {
				internalFormat: providedFormat,
				textureFormat: context.RGB,
				type: context.UNSIGNED_BYTE,
			}
		case context.RGB8_SNORM:
			return {
				internalFormat: providedFormat,
				textureFormat: context.RGB,
				type: context.BYTE,
			}
		case context.RGB16F:
		case context.R11F_G11F_B10F:
		case context.RGB9_E5:
			return {
				internalFormat: providedFormat,
				textureFormat: context.RGB,
				type: context.HALF_FLOAT,
			}
		case context.RGB32F:
			return {
				internalFormat: providedFormat,
				textureFormat: context.RGB,
				type: context.FLOAT,
			}
		case context.RGB8UI:
			return {
				internalFormat: providedFormat,
				textureFormat: context.RGB_INTEGER,
				type: context.UNSIGNED_BYTE,
			}
		case context.RGB8I:
			return {
				internalFormat: providedFormat,
				textureFormat: context.RGB_INTEGER,
				type: context.BYTE,
			}
		case context.RGB16UI:
			return {
				internalFormat: providedFormat,
				textureFormat: context.RGB_INTEGER,
				type: context.UNSIGNED_SHORT,
			}
		case context.RGB16I:
			return {
				internalFormat: providedFormat,
				textureFormat: context.RGB_INTEGER,
				type: context.SHORT,
			}
		case context.RGB32UI:
			return {
				internalFormat: providedFormat,
				textureFormat: context.RGB_INTEGER,
				type: context.UNSIGNED_INT,
			}
		case context.RGB32I:
			return {
				internalFormat: providedFormat,
				textureFormat: context.RGB_INTEGER,
				type: context.INT,
			}
		case context.DEPTH_COMPONENT16:
			return {
				internalFormat: providedFormat,
				textureFormat: context.DEPTH_COMPONENT,
				type: context.UNSIGNED_SHORT,
			}
		case context.DEPTH_COMPONENT24:
			return {
				internalFormat: providedFormat,
				textureFormat: context.DEPTH_COMPONENT,
				type: context.UNSIGNED_INT,
			}
		case context.DEPTH_COMPONENT32F:
			return {
				internalFormat: providedFormat,
				textureFormat: context.DEPTH_COMPONENT,
				type: context.FLOAT,
			}
		case context.DEPTH24_STENCIL8:
			return {
				internalFormat: providedFormat,
				textureFormat: context.DEPTH_STENCIL,
				type: context.UNSIGNED_INT_24_8,
			}
		case context.DEPTH32F_STENCIL8:
			return {
				internalFormat: providedFormat,
				textureFormat: context.DEPTH_STENCIL,
				type: context.FLOAT_32_UNSIGNED_INT_24_8_REV,
			}
		// DEPTH_COMPONENT and DEPTH_STENCIL are invalid internalFormats,
		// so we have to account for those too
		case context.DEPTH_COMPONENT:
			return getFormatsFromInternalFormat(context, context.DEPTH_COMPONENT24)
		case context.DEPTH_STENCIL:
			return getFormatsFromInternalFormat(context, context.DEPTH24_STENCIL8)

		case context.RGBA:
		case context.RGB:
		case context.LUMINANCE_ALPHA:
		case context.LUMINANCE:
		case context.ALPHA:
			return {
				internalFormat: providedFormat,
				textureFormat: providedFormat,
				type: context.UNSIGNED_BYTE,
			}
		default:
			throw new Error('Attempted to create polyfill with unsupported format.')
	}
}
