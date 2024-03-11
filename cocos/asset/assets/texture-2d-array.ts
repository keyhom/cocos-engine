import { EDITOR, TEST } from 'internal:constants';
import { cclegacy, js } from '../../core';
import { PresumedGFXTextureInfo, PresumedGFXTextureViewInfo, SimpleTexture } from './simple-texture';

import { ccclass, serializable, type } from 'cc.decorator';
import { PixelFormat } from './asset-enum';
import { ImageAsset } from './image-asset';
import { TextureInfo, TextureType, TextureViewInfo } from '../../gfx';
import { Texture2D } from './texture-2d';
import { max } from '../../core/math/bits';

/**
 * @en The create information for [[Texture2DArray]].
 * @zh 用来创建2D数组贴图的信息。
 */
export interface ITexture2DArrayCreateInfo {

    /**
     * @en The pixel width.
     * @zh 像素宽度。
     */
    width: number;

    /**
     * @en The pixel height.
     * @zh 像素高度。
     */
    height: number;

    /**
     * @en The pixel format.
     * @zh 像素格式。
     * @default PixelFormat.RGBA8888
     */
    format?: PixelFormat;

    /**
     * @en The mipmap level count.
     * @zh mipmap 层级。
     * @default 1
     */
    mipmapLevel?: number;

    /**
     * @en The selected base mipmap level.
     * @zh 选择使用的最小 mipmap 层级。
     * @default 1
     */
    baseLevel?: number;

    /**
     * @en The selected maximum mipmap level.
     * @zh 选择使用的最大 mipmap 层级。
     * @default 1000
     */
    maxLevel?: number;

}

type ITexture2DArrayMipmaps = ImageAsset[];

@ccclass('cc.Texture2DArray')
export class Texture2DArray extends SimpleTexture {

    // @serializable
    @type([[ImageAsset]])
    public _mipmaps: ITexture2DArrayMipmaps[] = [];

    private _generatedMipmaps: ITexture2DArrayMipmaps[] = [];

    get mipmaps(): ITexture2DArrayMipmaps[] {
        return this._mipmaps;
    }

    set mipmaps(value: ITexture2DArrayMipmaps[]) {
        this._mipmaps = value;

        const mipmaps: ImageAsset[][] = [];

        if (value.length === 1) {
            const mipmapsSlices = value[0];
            const sliceMipmaps: ImageAsset[][] = [];
            let maxMipmapLevel: number = 0;

            for (let n = 0; n < mipmapsSlices.length; n++) {
                sliceMipmaps[n] = mipmapsSlices[n].extractMipmaps();
                maxMipmapLevel = max(maxMipmapLevel, sliceMipmaps[n].length);
            }

            for (let n = 0; n < mipmapsSlices.length; n++) {
                if (sliceMipmaps[n].length != maxMipmapLevel) {
                    console.error('The number of mipmaps of each slice is different.');
                    this._setMipmapParams([]);
                    return;
                }
            }

            for (let i = 0; i < maxMipmapLevel; i++) {
                for (let n = 0; n < sliceMipmaps.length; n++) {
                    mipmaps[i] = mipmaps[i] || [];
                    mipmaps[i].push(sliceMipmaps[n][i]);
                }
            }
        } else if (value.length > 1) {
            for (let i = 0; i < value.length; ++i) {
                const slices = value[i];
                for (let n = 0; n < slices.length; ++n) {
                    mipmaps[i] = mipmaps[i] || [];
                    mipmaps[i].push(slices[n].extractMipmap0());
                }
            }
        }

        this._setMipmapParams(mipmaps);
    }

    private _setMipmapParams(value: ImageAsset[][]): void {
        this._generatedMipmaps = value;
        this._setMipmapLevel(this._generatedMipmaps.length);
        if (this._generatedMipmaps.length > 0 && this._generatedMipmaps[0]?.length > 0) {
            const imageAsset: ImageAsset = this._generatedMipmaps[0][0];
            this.reset({
                width: imageAsset.width,
                height: imageAsset.height,
                format: imageAsset.format,
                mipmapLevel: this._generatedMipmaps.length,
                baseLevel: this._baseLevel,
                maxLevel: this._maxLevel,
            });
            this._generatedMipmaps.forEach((mipmapSlices, level) => {
                for (let i = 0; i < mipmapSlices.length; ++i) {
                    this._assignImage(mipmapSlices[i], level, i);
                }
            });
        } else {
            this.reset({
                width: 0,
                height: 0,
                mipmapLevel: this._generatedMipmaps.length,
                baseLevel: this._baseLevel,
                maxLevel: this._maxLevel
            });
        }
    }

    get slicesCount(): number {
        return this._mipmaps.length > 0 && this._mipmaps[0]?.length > 0 ? this._mipmaps[0].length : 0;
    }

    get image(): ITexture2DArrayMipmaps | null {
        return this._mipmaps.length === 0 ? null : this._mipmaps[0];
    }

    set image(value) {
        this.mipmaps = value ? [value] : [];
    }

    public static create(textures: Texture2D[], slicesCount: number = 1, out?: Texture2DArray): Texture2DArray {
        const mipmaps: ITexture2DArrayMipmaps[] = [];
        const nMipmaps = textures.length / slicesCount;

        for (let i = 0; i < nMipmaps; i++) {
            const x = i * slicesCount;
            mipmaps[i].push(textures[x].image!);
        }

        out = out || new Texture2DArray();
        out.mipmaps = mipmaps;
        return out;
    }

    public initialize(): void {
        this.mipmaps = this._mipmaps;
    }

    public onLoaded(): void {
        this.initialize();
    }

    public reset(info: ITexture2DArrayCreateInfo): void {
        this._width = info.width;
        this._height = info.height;
        this._setGFXFormat(info.format);
        const mipLevels = info.mipmapLevel === undefined ? 1 : info.mipmapLevel;
        this._setMipmapLevel(mipLevels);
        const minLod = info.baseLevel === undefined ? 0 : info.baseLevel;
        const maxLod = info.maxLevel === undefined ? 1000 : info.maxLevel;
        this._setMipRange(minLod, maxLod);
        this._tryReset();
    }

    public updateMipmaps(firstLevel: number = 0, count?: number | undefined): void {
        if (firstLevel >= this._generatedMipmaps.length)
            return;

        const nUpdate = Math.min(
            count === undefined ? this._generatedMipmaps.length : count,
            this._generatedMipmaps.length - firstLevel,
        );

        for (let i = 0; i < nUpdate; i++) {
            const level = firstLevel + i;
            const slices: ImageAsset[] = this._generatedMipmaps[level];
            for (let n = 0; n < slices.length; n++) {
                this._assignImage(slices[n], level, n);
            }
        }
    }

    public description(): string {
        return `<cc.Texture2DArray | SlicesCount = ${this.slicesCount} | Dimension = ${this.width}x${this.height}>`;
    }

    public destroy(): boolean {
        this._mipmaps = [];
        this._generatedMipmaps = [];
        return super.destroy();
    }

    public releaseTexture(): void {
        this.destroy();
    }

    public _serialize(ctxForExporting: any): Record<string, unknown> | null {
        // console.warn(`Texture2DArray:_serialize`);
        if (EDITOR || TEST) {
            return {
                base: super._serialize(ctxForExporting),
                slice: this._mipmaps.length && this._mipmaps[0]?.length > 0 ? this._mipmaps[0].length : 0,
                mipmaps: this._mipmaps.map((mipmapSlices) => {
                    const output: string[] = [];
                    if (ctxForExporting && ctxForExporting._compressUuid) {
                        for (let i = 0; i < mipmapSlices.length; i++) {
                            output[i] = EditorExtends.UuidUtils.compressUuid(mipmapSlices[i]._uuid, true);
                        }
                    }
                    else {
                        for (let i = 0; i < mipmapSlices.length; i++) {
                            output[i] = mipmapSlices[i]._uuid;
                        }
                    }
                    return output;
                }),
            };
        }
        return null;
    }

    public _deserialize(serializedData: ITexture2DArraySerializeData, handle: any): void {
        // console.warn(`Texture2DArray:_deserialize`);
        const data = serializedData;
        super._deserialize(data.base, handle);

        this._mipmaps = new Array(data.mipmaps.length);
        for (let i = 0; i < data.mipmaps.length; i++) {
            this._mipmaps[i] = [];
            const mipmapSlices = data.mipmaps[i];
            const imageAssetClassId = js.getClassId(ImageAsset);

            for (let n = 0; n < data.slice; n++) {
                handle.result.push(this._mipmaps[i], `${n}`, mipmapSlices[n], imageAssetClassId);
            }
        }
    }

    protected _getGfxTextureCreateInfo(presumed: PresumedGFXTextureInfo): TextureInfo | null {
        const texInfo = new TextureInfo(TextureType.TEX2D_ARRAY);
        texInfo.width = this._width;
        texInfo.height = this._height;
        texInfo.layerCount = this.slicesCount;
        Object.assign(texInfo, presumed);
        return texInfo;
    }

    protected _getGfxTextureViewCreateInfo(presumed: PresumedGFXTextureViewInfo): TextureViewInfo | null {
        const texViewInfo = new TextureViewInfo();
        texViewInfo.type = TextureType.TEX2D_ARRAY;
        texViewInfo.baseLayer = 0;
        texViewInfo.layerCount = this.slicesCount;
        Object.assign(texViewInfo, presumed);
        return texViewInfo;
    }

    public initDefault(uuid?: string): void {
        super.initDefault(uuid);

        const imageAsset = new ImageAsset();
        imageAsset.initDefault();
        this.mipmaps = [[imageAsset]];
    }

    public validate(): boolean {
        return this.mipmaps && this.mipmaps.length > 0;
    }

}

cclegacy.Texture2DArray = Texture2DArray;

interface ITexture2DArraySerializeData {
    base: string;
    slice: number;
    mipmaps: ImageAsset[][];
}
