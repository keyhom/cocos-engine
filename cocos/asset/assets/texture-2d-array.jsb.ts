import { EDITOR, TEST } from 'internal:constants'
import { ImageAsset } from './image-asset';
import { SimpleTexture } from './simple-texture';
import { TextureBase } from './texture-base.jsb';
import { js, cclegacy } from '../../core';
import { Filter, PixelFormat, WrapMode } from './asset-enum';
import './simple-texture';
import { patch_cc_Texture2D } from '../../native-binding/decorators';
import type { Texture2D as JsbTexture2D } from './texture-2d';

declare const jsb: any;
const texture2DProto: any = jsb.Texture2D.prototype;

texture2DProto.createNode = null!;

export type Texture2D = JsbTexture2D;
export const Texture2D: typeof JsbTexture2D = jsb.Texture2D;

Texture2D.Filter = Filter;
Texture2D.PixelFormat = PixelFormat;
Texture2D.WrapMode = WrapMode;

export interface ITexture2DSerializeData {
    base: string;
    mipmaps: string[];
}

texture2DProto._ctor = function () {
    // TODO: Property '_ctor' does not exist on type 'SimpleTexture'.
    // issue: https://github.com/cocos/cocos-engine/issues/14644
    (SimpleTexture.prototype as any)._ctor.apply(this, arguments);
    this._mipmaps = [];
};
