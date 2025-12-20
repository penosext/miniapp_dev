import { defineComponent } from 'vue';
import { Shell } from 'langningchen';
import { openSoftKeyboard } from '../../utils/softKeyboardUtils'; // 确保路径正确

export default defineComponent({
    data() {
        return {
            shell: new Shell() as any,
            command: "",
            output: "--- Shell Ready ---\n",
            busy: false,
        };
    },
    mounted() {
        // 1. 初始化 Shell
        this.shell.initialize();
    },
    methods: {
        // 唤起键盘
        openInput() {
            if (this.busy) return;
            
            openSoftKeyboard(
                () => this.command, 
                (value: string) => {
                    // 【关键点】当键盘点击确认时，会执行这个回调
                    this.command = value;
                    this.$forceUpdate(); // 强制刷新视图，确保文本显示出来
                    
                    // 可选：如果你希望点击键盘
