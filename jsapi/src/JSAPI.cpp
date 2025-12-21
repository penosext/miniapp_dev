#include <jsmodules/JSCModuleExtension.h>
#include <jquick_config.h>

#include "AI/JSAI.hpp"
#include "IME/JSIME.hpp"
#include "ScanInput/JSScanInput.hpp"
#include "Shell/JSShell.hpp"   // ✅ 确保包含Shell头文件

using namespace JQUTIL_NS;

static std::vector<std::string> exportList = {
    "AI",
    "IME",
    "ScanInput",
    "Shell"
};

static int module_init(JSContext *ctx, JSModuleDef *m)
{
    auto env = JQModuleEnv::CreateModule(ctx, m, "langningchen");

    env->setModuleExport("AI", createAI(env.get()));
    env->setModuleExport("IME", createIME(env.get()));
    env->setModuleExport("ScanInput", createScanInput(env.get()));
    env->setModuleExport("Shell", createShell(env.get()));

    env->setModuleExportDone(JS_UNDEFINED, exportList);
    return 0;
}

DEF_MODULE_LOAD_FUNC_EXPORT(langningchen, module_init, exportList)

extern "C" JQUICK_EXPORT void custom_init_jsapis()
{
    registerCModuleLoader("langningchen", &langningchen_module_load);
}