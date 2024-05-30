import { EDITOR, TEST } from 'internal:constants'
import { js, cclegacy } from '../../core';
import { Filter, PixelFormat, WrapMode } from './asset-enum';
import './simple-texture';
import { patch_cc_Texture2DArray } from '../../native-binding/decorators';
import type { Texture2DArray as JsbTexture2DArray } from './texture-2d-array';

declare const jsb: any;
const texture2DArrayProto: any = jsb.Texture2DArray.prototype;
interface ITexture2DArraySerializeData {
    base: string;
    slice: number;
    mipmaps: string[][];
}

texture2DArrayProto.createNode = null!;

export type Texture2DArray = JsbTexture2DArray;
export const Texture2DArray: typeof JsbTexture2DArray = jsb.Texture2DArray;

Texture2DArray.Filter = Filter;
Texture2DArray.PixelFormat = PixelFormat;
Texture2DArray.WrapMode = WrapMode;

texture2DArrayProto._ctor = function () {
    jsb.SimpleTexture.prototype._ctor.apply(this, arguments);
    this._mipmaps = [];
};

Object.defineProperty(texture2DArrayProto, 'mipmaps', {
    get () {
        return this._mipmaps;
    },
    set (value) {
        this._mipmaps = value;
        this.setMipmaps(value);
    }
});

// FIXME: bugs accquired?
Object.defineProperty(texture2DArrayProto, 'image', {
    get () {
        return this._mipmaps.length == 0 ? null : this._mipmaps[0];
    },
    set (value) {
        this.mipmaps = value ? [value] : [];
    }
});

const oldOnLoaded = texture2DArrayProto.onLoaded;
texture2DArrayProto.onLoaded = function () {
    this.setMipmapsForJS(this._mipmaps);
    oldOnLoaded.apply(this);
}

texture2DArrayProto._serialize = function (ctxForExporting: any): Record<string, unknown> | null {
    // console.warn(`Texture2DArray:_serialize`);
    if (EDITOR || TEST) {
        return {
            base: jsb.TextureBase.prototype._serialize(ctxForExporting),
            slice: this._mipmaps.length && this._mipmaps[0]?.slices.length > 0 ? this._mipmaps[0].slices.length : 0,
            mipmaps: this._mipmaps.map((mipmapSlices) => {
                    const output: string[] = [];
                    if (ctxForExporting && ctxForExporting._compressUuid) {
                        for (let i = 0; i < mipmapSlices.slices.length; i++) {
                            output[i] = EditorExtends.UuidUtils.compressUuid(mipmapSlices.slices[i]._uuid, true);
                        }
                    }
                    else {
                        for (let i = 0; i < mipmapSlices.slices.length; i++) {
                            output[i] = mipmapSlices.slices[i]._uuid;
                        }
                    }
                    return output;
            }),
        };
    }

    return null;
}

texture2DArrayProto._deserialize = function (serializedData: ITexture2DArraySerializeData, handle: any) {
    // console.warn(`Texture2DArray:_deserialize`);
    const data = serializedData;
    jsb.TextureBase.prototype._deserialize.call(this, data.base, handle);

    this._mipmaps = new Array(data.mipmaps.length);
    for (let i = 0; i < data.mipmaps.length; i++) {
        this._mipmaps[i] = { slices: [] };
        const mipmapSlices = data.mipmaps[i];
        const imageAssetClassId = js.getClassId(jsb.ImageAsset);

        for (let n = 0; n < data.slice; n++) {
            handle.result.push(this._mipmaps[i].slices, `${n}`, mipmapSlices[n], imageAssetClassId);
        }
    }
}

cclegacy.Texture2DArray = jsb.Texture2DArray;

// handle meta data, it is generated automatically
patch_cc_Texture2DArray({ Texture2DArray });
