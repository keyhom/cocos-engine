#include "core/assets/Texture2DArray.h"
#include "core/assets/ImageAsset.h"
#include "core/assets/Texture2D.h"
#include "renderer/gfx-base/GFXTexture.h"

namespace cc {

Texture2DArray *Texture2DArray::create(const ccstd::vector<Texture2D *> &textures, uint32_t slicesCount) {
    size_t nMipmaps = textures.size() / slicesCount;
    ccstd::vector<ITexture2DArrayMipmaps> mipmaps;
    mipmaps.reserve(nMipmaps);

    for (size_t i = 0; i < nMipmaps; i++) {
        size_t x = i * slicesCount;
        mipmaps[i].emplace_back(textures[x]->getImage());
    }

    auto *out = ccnew Texture2DArray();
    out->setMipmaps(mipmaps);

    return out;
}

Texture2DArray::Texture2DArray() = default;
Texture2DArray::~Texture2DArray() = default;

void Texture2DArray::setMipmaps(const ccstd::vector<ITexture2DArrayMipmaps> &value) {
    _mipmaps = value;

    ccstd::vector<ITexture2DArrayMipmaps> mipmaps{{}};
    mipmaps.reserve(value.size());

    if (value.size() == 1) {
        const ITexture2DArrayMipmaps &mipmapsSlices = value[0];
        ccstd::vector<ITexture2DArrayMipmaps> sliceMipmaps{{}};
        size_t maxMipmapLevel = 0;

        sliceMipmaps.resize(mipmapsSlices.size());

        for (size_t n = 0; n < mipmapsSlices.size(); n++) {
            sliceMipmaps[n] = mipmapsSlices[0]->extractMipmaps();
            maxMipmapLevel = std::max(maxMipmapLevel, sliceMipmaps[n].size());
        }

        for (size_t n = 0; n < mipmapsSlices.size(); n++) {
            if (sliceMipmaps[n].size() != maxMipmapLevel) {
                assert("The number of mipmaps of each slice is different.");
                setMipmapParams({});
                return;
            }
        }

        mipmaps.reserve(maxMipmapLevel);

        for (size_t i = 0; i < maxMipmapLevel; i++) {
            for (auto & sliceMipmap : sliceMipmaps) {
                mipmaps[i].emplace_back(sliceMipmap[i]);
            }
        }
    } else if (value.size() > 1) {
        for (size_t i = 0; i < value.size(); i++) {
            auto slices = value.at(i);
            for (const auto & slice : slices) {
                mipmaps[i].emplace_back(slice->extractMipmap0());
            }
        }
    }

    setMipmapParams(mipmaps);
}

void Texture2DArray::setMipmapParams(const ccstd::vector<ITexture2DArrayMipmaps> &value) {
    _generatedMipmaps = value;
    setMipmapLevel(static_cast<uint32_t>(_generatedMipmaps.size()));

    if (!_generatedMipmaps.empty() && !_generatedMipmaps[0].empty()) {
        ImageAsset *imageAsset = _generatedMipmaps[0][0];
        reset({imageAsset->getWidth(),
               imageAsset->getHeight(),
               imageAsset->getFormat(),
               static_cast<uint32_t>(_generatedMipmaps.size()),
               _baseLevel,
               _maxLevel});
        for (size_t i = 0; i < _generatedMipmaps.size(); i++) {
            auto mipmapSlices = _generatedMipmaps[i];
            for (size_t n = 0; n < mipmapSlices.size(); n++) {
                assignImage(mipmapSlices[n], i, n);
            }
        }
    } else {
        reset({0, 0, ccstd::nullopt, static_cast<uint32_t>(_generatedMipmaps.size()), _baseLevel, _maxLevel});
    }
}

void Texture2DArray::setMipmapsForJs(const ccstd::vector<ITexture2DArrayMipmaps> &value) {
    _mipmaps = value;
}

void Texture2DArray::setImage(const ITexture2DArrayMipmaps *value) {
    if (value != nullptr) {
        setMipmaps({*value});
    } else {
        setMipmaps({});
    }
}

void Texture2DArray::reset(const ITexture2DArrayCreateInfo &info) {
    _width = info.width;
    _height = info.height;
    setGFXFormat(info.format);

    uint32_t mipLevels = info.mipmapLevel.has_value() ? info.mipmapLevel.value() : 1;
    setMipmapLevel(mipLevels);

    uint32_t minLod = info.baseLevel.has_value() ? info.mipmapLevel.value() : 0;
    uint32_t maxLod = info.maxLevel.has_value() ? info.maxLevel.value() : 1000;
    setMipRange(minLod, maxLod);

    tryReset();
}

void Texture2DArray::updateMipmaps(uint32_t firstLevel, uint32_t count) {
    if (firstLevel >= _generatedMipmaps.size()) {
        return;
    }

    auto nUpdate = static_cast<uint32_t>(std::min(count == 0 ? _generatedMipmaps.size() : count, _generatedMipmaps.size() - firstLevel));

    for (size_t i = 0; i < nUpdate; i++) {
        size_t level = firstLevel + i;
        ccstd::vector<IntrusivePtr<ImageAsset>> slices = _generatedMipmaps[level];
        for (size_t n = 0; n < slices.size(); n++) {
            assignImage(slices[n], level, n);
        }
    }
}

void Texture2DArray::initialize() {
    setMipmaps(_mipmaps);
}

void Texture2DArray::onLoaded() {
    initialize();
}

bool Texture2DArray::destroy() {
    _mipmaps.clear();
    _generatedMipmaps.clear();
    return Super::destroy();
}

void Texture2DArray::releaseTexture() {
    destroy();
}

ccstd::any Texture2DArray::serialize(const ccstd::any &ctxForExporting) {
    // FIXME: serialize
    return nullptr;
}

void Texture2DArray::deserialize(const ccstd::any &serializedData, const ccstd::any &handle) {
    const auto *data = ccstd::any_cast<Texture2DArraySerializeData>(&serializedData);
    if (data == nullptr) {
        return;
    }

    Super::deserialize(data->base, handle);
    _mipmaps.resize(data->mipmaps.size());

    for (size_t i = 0; i < data->mipmaps.size(); i++) {
        const auto mipmapSlices = data->mipmaps[i];
        _mipmaps[i].resize(data->slice);
        for (size_t n = 0; n < data->slice; n++) {
            _mipmaps[i].emplace_back(ccnew ImageAsset());
        }
    }
}

gfx::TextureInfo Texture2DArray::getGfxTextureCreateInfo(gfx::TextureUsageBit usage, gfx::Format format, uint32_t levelCount, gfx::TextureFlagBit flags) {
    gfx::TextureInfo texInfo;
    texInfo.type = gfx::TextureType::TEX2D_ARRAY;
    texInfo.width = _width;
    texInfo.height = _height;
    texInfo.layerCount = getSlicesCount();
    texInfo.usage = usage;
    texInfo.format = format;
    texInfo.levelCount = levelCount;
    texInfo.flags = flags;
    return texInfo;
}

gfx::TextureViewInfo Texture2DArray::getGfxTextureViewCreateInfo(gfx::Texture *texture, gfx::Format format, uint32_t baseLevel, uint32_t levelCount) {
    gfx::TextureViewInfo texViewInfo;
    texViewInfo.type = gfx::TextureType::TEX2D_ARRAY;
    texViewInfo.baseLayer = 0;
    texViewInfo.layerCount = getSlicesCount();
    texViewInfo.texture = texture;
    texViewInfo.format = format;
    texViewInfo.baseLevel = baseLevel;
    texViewInfo.levelCount = levelCount;

    return texViewInfo;
}

void Texture2DArray::initDefault(const ccstd::optional<ccstd::string> &uuid) {
    Super::initDefault(uuid);

    auto *imageAsset = ccnew ImageAsset();
    imageAsset->initDefault(ccstd::nullopt);

    ITexture2DArrayMipmaps mipmap;

    mipmap.emplace_back(imageAsset);
    setMipmaps({mipmap});
}

bool Texture2DArray::validate() const {
    auto mipmaps = getMipmaps();
    return !mipmaps.empty();
}

} // namespace cc
