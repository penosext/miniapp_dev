// Copyright (C) 2025 Langning Chen

type Getter = () => string;
type Setter = (value: string) => void;

/**
 * 关键：把软键盘返回的任意值规整为 string
 * 不改变任何协议结构
 */
function normalizeKeyboardInput(input: any): string {
    if (typeof input === 'string') return input;

    if (input && typeof input === 'object') {
        if (typeof input.value === 'string') return input.value;
        if (typeof input.text === 'string') return input.text;
        if (typeof input.key === 'string') return input.key;
    }

    return '';
}

export function openSoftKeyboard(getter: Getter, setter: Setter) {
    // ⚠️ 这里的 trigger 名、参数结构，必须和你原来的一模一样
    $falcon.trigger('open_soft_keyboard', {
        value: getter(),

        // ✅ 只在这里做“最小侵入式修改”
        onInput: (raw: any) => {
            const value = normalizeKeyboardInput(raw);
            setter(value);
        },

        // 如果你原来就有 delete
        onDelete: () => {
            const current = getter();
            setter(current.slice(0, -1));
        },

        // 如果你原来就有 confirm
        onConfirm: (raw: any) => {
            const value = normalizeKeyboardInput(raw);
            setter(value);
        }
    });
}
