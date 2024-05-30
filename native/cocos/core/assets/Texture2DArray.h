#pragma once

#include "base/Ptr.h"
#include "base/std/optional.h"
#include "core/assets/SimpleTexture.h"

namespace cc {

class ImageAsset;
class Texture2D;
struct ITexture2DCreateInfo;

using ITexture2DArrayCreateInfo = ITexture2DCreateInfo;

// using ITexture2DArrayMipmaps = ccstd::vector<IntrusivePtr<ImageAsset>>;
struct ITexture2DArrayMipmaps {
    ccstd::vector<IntrusivePtr<ImageAsset>> slices;
};

using ITexture2DArrayMipmapData = ccstd::vector<ccstd::string>;

struct Texture2DArraySerializeData {
    ccstd::string base;
    uint32_t slice;
    ccstd::vector<ccstd::vector<ccstd::string>> mipmaps;
};

/**
 * Texture2DArray
 */
class Texture2DArray final : public SimpleTexture {
public:
    using Super = SimpleTexture;

    Texture2DArray();
    ~Texture2DArray() override;

    static Texture2DArray *create(const ccstd::vector<Texture2D *> &textures, uint32_t slicesCount);

    size_t getSlicesCount() const {
        // return (!this->_mipmaps.empty() && !this->_mipmaps[0].empty()) ? this->_mipmaps[0].size() : 0;
        return (!_mipmaps.empty() && !_mipmaps[0].slices.empty()) ? _mipmaps[0].slices.size() : 0;
    }

    const ccstd::vector<ITexture2DArrayMipmaps> &getMipmaps() const {
        return _mipmaps;
    }

    void setMipmaps(const ccstd::vector<ITexture2DArrayMipmaps> &value);

    void setMipmapsForJS(const ccstd::vector<ITexture2DArrayMipmaps> &value);

    const ITexture2DArrayMipmaps *getImage() const {
        return _mipmaps.empty() ? nullptr : &_mipmaps.at(0);
    }

    void setImage(const ITexture2DArrayMipmaps *value);

    void reset(const ITexture2DArrayCreateInfo &info);

    void releaseTexture();

    void updateMipmaps(uint32_t firstLevel, uint32_t count) override;

    void initialize();

    void onLoaded() override;

    bool destroy() override;

    ccstd::any serialize(const ccstd::any &ctxForExporting) override;
    void deserialize(const ccstd::any &serializedData, const ccstd::any &handle) override;

    gfx::TextureInfo getGfxTextureCreateInfo(gfx::TextureUsageBit usage, gfx::Format format, uint32_t levelCount, gfx::TextureFlagBit flags) override;
    gfx::TextureViewInfo getGfxTextureViewCreateInfo(gfx::Texture *texture, gfx::Format format, uint32_t baseLevel, uint32_t levelCount) override;

    void initDefault(const ccstd::optional<ccstd::string> &uuid) override;

    bool validate() const override;

private:
    void setMipmapParams(const ccstd::vector<ITexture2DArrayMipmaps> &value);

    ccstd::vector<ITexture2DArrayMipmaps> _mipmaps;
    ccstd::vector<ITexture2DArrayMipmaps> _generatedMipmaps;

    CC_DISALLOW_COPY_MOVE_ASSIGN(Texture2DArray);

}; // class Texture2DArray

} // namespace cc
