// Copyright (C) 2025 Langning Chen
// 
// This file is part of miniapp.
// 
// miniapp is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
// 
// miniapp is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
// 
// You should have received a copy of the GNU General Public License
// along with miniapp.  If not, see <https://www.gnu.org/licenses/>.

import { showWarning } from '../components/ToastMessage';

/**
 * 【新增】将软键盘返回的数据安全地转换为 string
 * 只为修复 [object Object]，不改变任何原有流程
 */
function normalizeKeyboardData(data: any): string {
    if (typeof data === 'string') {
        return data;
    }

    if (data && typeof data === 'object') {
        if (typeof data.value === 'string') return data.value;
        if (typeof data.text === 'string') return data.text;
        if (typeof data.key === 'string') return data.key;
    }

    // 保底，避免 String(object)
    return '';
}

export function openSoftKeyboard(
    get: () => string,
    set: (value: string) => void,
    validate?: (value: string) => string | undefined
) {
    const currentValue = get();
    $falcon.navTo('softKeyboard', { data: currentValue });

    const handler = (e: { data: any }) => {
        // ⭐【唯一修复点】
        const newValue = normalizeKeyboardData(e.data);

        if (validate) {
            const validationError = validate(newValue);
            if (validationError) {
                showWarning(validationError);
                $falcon.off('softKeyboard', handler);
                return;
            }
        }

        set(newValue);
        $falcon.off('softKeyboard', handler);
    };

    $falcon.on('softKeyboard', handler);
}
