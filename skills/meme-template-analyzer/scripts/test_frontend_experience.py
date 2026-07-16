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
            "instruction": "保持模板参考图的构图和阅读顺序。只输出最终成图；不得显示模板标题、槽位框、组件标签、组件 ID、虚线连线、图例、操作说明、界面元素或任何编辑标注。",
            "preserve": ["人物与宠物的相对位置"],
        },
        "inputSchema": [
            {"type": "subject", "id": "person", "label": "人物", "required": False, "text": {"defaultValue": "穿长外套的人", "suggestions": ["短发青年"]}},
            {"type": "subject", "id": "pet", "label": "宠物", "required": False, "text": {"defaultValue": "低头小狗", "suggestions": ["柯基犬"]}},
        ],
        "metadata": {
            "inputSemantics": {
                "person": {"semanticType": "person_identity", "defaultStateLabel": "保留原人物", "textInputLabel": "或用文字描述人物", "uploadLabel": "上传人物图"},
                "pet": {"semanticType": "pet_identity", "defaultStateLabel": "保留原宠物", "textInputLabel": "或用文字描述宠物", "uploadLabel": "上传宠物图"},
            },
            "presentation": {"recommendedOutputRatio": "3:4", "referenceImageRemovable": False},
            "runtimeRequirements": {"subjectInputVersion": 2, "supportsMultipleSubjectImages": True, "imageSlotAddressing": "input_id"},
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
    assert any("component-diagram language" in error for error in errors)
    assert any("internal enumerated ids" in error for error in errors)
    assert validate(good, "legacy-single-image")
    print("PASS frontend experience tests")


if __name__ == "__main__":
    main()
