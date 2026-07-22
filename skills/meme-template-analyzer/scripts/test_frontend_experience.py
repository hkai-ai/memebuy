#!/usr/bin/env python3

from validate_frontend_experience import validate


def sample() -> dict:
    return {
        "title": "蓝天下遛狗",
        "description": "替换人物、宠物与穿着",
        "referenceImage": "https://assets.example.com/source.png",
        "imageSize": "768x1024",
        "promptTemplate": "{{ person | \"穿长外套的人\" }}与{{ pet | \"低头小狗\" }}在蓝天下散步。",
        "promptEnhancement": {
            "instruction": "把基础提示词改写成一条完整、可直接执行的图像生成提示词。用户在开放槽位中填写或上传的内容是本次生成的主体意图，必须完整体现。参考图在构图、画幅、裁切、镜头景别、背景、留白、画风、媒介、材质、色调与光影维度上具有最高权限，在画面内容与主体身份维度上不具权限。不要用文字复述参考图中的具体画面内容。只输出最终成图；不得显示模板标题、槽位框、组件标签、组件 ID、虚线连线、图例、操作说明、界面元素或任何编辑标注。",
            "lockedConstraints": [
                "沿用参考图的画幅、裁切、留白、镜头景别与元素位置比例",
                "沿用参考图的媒介质感、材质表现与色彩关系",
                "沿用参考图的前景背景层级、遮挡关系与阅读顺序",
            ],
            "preserve": ["人物与陪伴动物必须共同参与散步关系"],
        },
        "inputSchema": [
            {"type": "subject", "id": "person", "label": "左侧主体", "required": False, "text": {"defaultValue": "穿长外套的人", "suggestions": ["穿长外套的人", "短发青年", "戴帽子的原创人物", "拟人化机器人"]}, "image": {"promptValue": "用户上传图中的主体"}},
            {"type": "subject", "id": "pet", "label": "右侧主体", "required": False, "text": {"defaultValue": "低头小狗", "suggestions": ["低头小狗", "橘色短毛猫", "垂耳兔", "原创动物角色"]}, "image": {"promptValue": "用户上传图中的主体"}},
        ],
        "metadata": {
            "inputSemantics": {
                "person": {"semanticType": "subject_identity", "defaultStateLabel": "保留原主体", "textInputLabel": "或用文字描述主体", "uploadLabel": "上传主体图"},
                "pet": {"semanticType": "subject_identity", "defaultStateLabel": "保留原主体", "textInputLabel": "或用文字描述主体", "uploadLabel": "上传主体图"},
            },
            "presentation": {"recommendedOutputRatio": "3:4", "referenceImageRemovable": False},
            "runtimeRequirements": {"subjectInputVersion": 2, "supportsMultipleSubjectImages": True, "imageSlotAddressing": "input_id"},
            "templateSource": {"authority": {"composition_authority": "high", "style_authority": "high", "identity_authority": "none"}},
        },
    }


def main() -> None:
    good = sample()
    assert validate(good) == []
    bad = sample()
    bad["title"] += "·组件槽位版"
    bad["description"] = "按可见组件开放编辑能力"
    bad["promptTemplate"] = "制作“测试”模板。{{ person | \"默认人物\" }}"
    bad["inputSchema"][0]["required"] = True
    bad["inputSchema"][0]["text"]["suggestions"] = ["复古版本"]
    bad["promptEnhancement"] = {
        "instruction": "按 reaction_portrait 组件图执行编辑。",
        "preserve": ["reaction_portrait_1", "reaction_portrait_2"],
    }
    bad["metadata"]["templateSource"] = {"preserve": ["reaction_portrait_1"]}
    errors = validate(bad)
    assert any("组件槽位版" in error for error in errors)
    assert any("usable fallback" in error for error in errors)
    assert any("mechanical suggestions" in error for error in errors)
    assert any("fewer than 3 distinct suggestions" in error for error in errors)
    assert any("component-diagram language" in error for error in errors)
    assert any("internal enumerated ids" in error for error in errors)

    authoring_prompt = sample()
    authoring_prompt["promptTemplate"] = (
        '沿用原画面的主题关系，通过以下开放项生成同构画面：'
        '{{ person | "穿长外套的人" }}；{{ pet | "低头小狗" }}。'
    )
    authoring_errors = validate(authoring_prompt)
    assert any("backend authoring instructions" in error for error in authoring_errors)
    assert any("slot inventory" in error for error in authoring_errors)

    labeled_inventory = sample()
    labeled_inventory["promptTemplate"] = (
        '主体为{{ person | "穿长外套的人" }}；陪伴对象为{{ pet | "低头小狗" }}。'
    )
    assert any("slot inventory" in error for error in validate(labeled_inventory))

    thin_choices = sample()
    thin_choices["inputSchema"].append(
        {"type": "prompt", "id": "prop", "label": "手持物件", "required": False,
         "suggestions": ["粉色莲花"]}
    )
    thin_choices["metadata"]["inputSemantics"]["prop"] = {"semanticType": "object_content"}
    assert any("fewer than 3 distinct suggestions" in error for error in validate(thin_choices))
    identity_limited = sample()
    identity_limited["inputSchema"][0]["label"] = "猫咪主体"
    identity_limited["inputSchema"][0]["image"]["promptValue"] = "用户上传图中的猫咪主体"
    identity_errors = validate(identity_limited)
    assert any("restricts uploaded subject identity" in error for error in identity_errors)

    incoherent = sample()
    incoherent["inputSchema"].append(
        {"type": "prompt", "id": "box_content", "label": "盒内内容", "required": False,
         "suggestions": ["盒子里的猫", "夜晚城市街景", "海边日落", "森林与薄雾"]}
    )
    incoherent["metadata"]["inputSemantics"]["box_content"] = {"semanticType": "object_content"}
    incoherent_errors = validate(incoherent)
    assert any("mixes external scene suggestions" in error for error in incoherent_errors)

    filler = sample()
    filler["inputSchema"].append(
        {"type": "prompt", "id": "drink", "label": "饮品", "required": False,
         "suggestions": ["咖啡", "简洁款饮品", "彩色手绘饮品", "用户自定义饮品"]}
    )
    filler["metadata"]["inputSemantics"]["drink"] = {"semanticType": "object_content"}
    assert any("label-derived filler suggestions" in error for error in validate(filler))

    overlapping = sample()
    overlapping["promptTemplate"] = '呈现“草莓甜品”画面：甜品为{{ dessert | "草莓奶油与果酱" }}；装饰为{{ garnish | "三颗草莓" }}。'
    overlapping["inputSchema"] = [
        {"type": "prompt", "id": "dessert", "label": "甜品内容", "required": False, "suggestions": ["草莓奶油与果酱"]},
        {"type": "prompt", "id": "garnish", "label": "装饰水果", "required": False, "suggestions": ["三颗草莓", "水蜜桃"]},
    ]
    overlapping["metadata"]["inputSemantics"] = {
        "dessert": {"semanticType": "object_content"},
        "garnish": {"semanticType": "decoration_design"},
    }
    overlap_errors = validate(overlapping)
    assert any("default attribute leaks outside its placeholder" in error for error in overlap_errors)
    assert any("editable slots overlap on the same attribute" in error for error in overlap_errors)

    weak_reference = sample()
    weak_reference["promptEnhancement"]["instruction"] = "生成一张相似图片。只输出最终成图。"
    weak_reference["promptEnhancement"]["lockedConstraints"] = ["保持画幅", "保持构图", "保持风格"]
    weak_errors = validate(weak_reference)
    assert any("does not enforce reference-first generation" in error for error in weak_errors)
    assert any("composition, style and spatial-relationship dimensions" in error for error in weak_errors)

    restated = sample()
    restated["promptEnhancement"]["lockedConstraints"][0] += "；图像依据：人物位于左侧"
    assert any("restates reference-image content" in error for error in validate(restated))

    duplicated = sample()
    duplicated["promptEnhancement"]["preserve"] = [duplicated["promptEnhancement"]["lockedConstraints"][0]]
    assert any("duplicates lockedConstraints" in error for error in validate(duplicated))

    visual_preserve = sample()
    visual_preserve["promptEnhancement"]["preserve"] = ["保持模板参考图的头像裁切和视觉风格"]
    assert any("visual restatements" in error for error in validate(visual_preserve))

    presentation_slot = sample()
    presentation_slot["promptTemplate"] += '{{ background | "蓝色背景" }}'
    presentation_slot["inputSchema"].append(
        {"type": "prompt", "id": "background", "label": "背景场景", "required": False}
    )
    presentation_slot["metadata"]["inputSemantics"]["background"] = {"semanticType": "background_design"}
    assert any("exposes presentation dimension" in error for error in validate(presentation_slot))

    unused = sample()
    unused["inputSchema"].append(
        {"type": "prompt", "id": "unused_prop", "label": "随身物", "required": False}
    )
    unused["metadata"]["inputSemantics"]["unused_prop"] = {"semanticType": "object_content"}
    assert any("is not used by promptTemplate" in error for error in validate(unused))

    select_slot = sample()
    select_slot["promptTemplate"] += '{{ accessory | "领结" }}'
    select_slot["inputSchema"].append(
        {"type": "select", "id": "accessory", "label": "颈前配饰", "required": False,
         "options": [{"value": "领结", "label": "领结"}, {"value": "领带", "label": "领带"}]}
    )
    select_slot["metadata"]["inputSemantics"]["accessory"] = {"semanticType": "accessory_content"}
    assert any("openSlotLabels only consumes prompt/subject" in error for error in validate(select_slot))
    assert validate(good, "legacy-single-image")
    print("PASS frontend experience tests")


if __name__ == "__main__":
    main()
