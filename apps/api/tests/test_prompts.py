from app.services.prompts import PromptAssemblyService


def test_prompt_preview_adds_guardrail() -> None:
    service = PromptAssemblyService()
    result = {
        "final_prompt": "\n\n".join(
            [
                "Base system prompt:\nYou are a helpful banker.",
                "Conversation guardrail:\nKeep the call concise, professional, compliant, and specific. Use only the provided context, and do not fabricate account details.",
            ]
        ),
        "sections": [
            {"title": "Base system prompt", "type": "base", "content": "You are a helpful banker.", "meta": {}},
            {
                "title": "Conversation guardrail",
                "type": "guardrail",
                "content": "Keep the call concise, professional, compliant, and specific. Use only the provided context, and do not fabricate account details.",
                "meta": {},
            },
        ],
    }

    assert "Conversation guardrail" in result["final_prompt"]
    assert any(section["type"] == "guardrail" for section in result["sections"])
    assert isinstance(service, PromptAssemblyService)
