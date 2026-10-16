# Roadster 渲染方案评估

评估日期：2026-10-16。此文记录已完成的检查与尚待测量的项目，不把引擎能力列表当作本 Demo 的实测结果。

## 当前结论

本轮在现有 Three.js 主 Demo 上升级车辆材质、照明、阴影、后处理和喷流，并完成独立 WebGPU / WebGL2 入口的实际后端检查。当前没有证据证明切换引擎就能提高车辆还原度，也没有可支持“世界第一”的统一基准或对比数据。

Unity 可作为后续独立 URP 原型的候选；本机尚无可用编辑器，当前未制作或测试 Unity 版本。不能将 Unity 桌面 HDRP 的能力直接承诺给网页版本。

## 已完成的 Unity 本机检查

- PowerShell `Get-Command unity, unity-cli, Unity` 未发现可执行命令。
- 未发现运行中的 Unity Editor / Unity Hub 进程。
- 未在常见系统与用户路径发现安装：`<system installation path>`、`<system installation path>`、`<user-profile installation path>`、`<user-profile installation path>`、`<user-profile installation path>`。
- 系统与当前用户的常见卸载注册表位置未发现 Unity / Unity Hub 登记。

这些是已检查范围内的结果，不能排除任意自定义目录中的便携安装。没有安装 CLI 或编辑器，没有创建 Unity 项目，没有执行 Unity 构建或画质、帧率测试。

## Unity 当前官方事实

| 项目 | 官方资料支持的结论 | 对本 Demo 的含义 |
| --- | --- | --- |
| Unity 6.6 WebGPU | WebGPU 在 Unity 6.6 中已成为正式支持的 Web 图形后端。 | 不能沿用较早版本“仍为实验性”的描述。 |
| 渲染管线 | Unity 6.6 平台功能表中，WebGPU 与 WebGL 的 URP 均支持，HDRP 均不支持。 | 网页迁移应评估 URP；HDRP 应另列桌面方案。 |
| WebGPU 功能 | 官方列出 GPU Resident Drawing、GPU Occlusion Culling、STP、VFX Graph、APV 和 Compute Skinning 等特性。 | 可供更复杂场景与 GPU 粒子方案选择，但必须在目标设备实际验证。 |
| 启用与回退 | WebGPU 需在 Player 的 Graphics API 列表中主动添加；可将 WebGL2 保留为下一优先级。 | 不能因开发机支持 WebGPU 就取消兼容路径。 |
| 功能边界 | 浏览器、设备和扩展支持有差异；Unity WebGPU 不支持同步 GPU 回读，也存在计算与纹理格式限制。 | 截图、离屏导出和自定义喷流计算需要适配与测试。 |

主源：

- [Unity 官方：WebGPU out of experimental in Unity 6.6](https://discussions.unity.com/t/webgpu-out-of-experimental-in-unity-6-6/1734694)
- [Unity 6.6：渲染管线功能比较](https://docs.unity3d.com/6000.6/Documentation/Manual/render-pipelines-feature-comparison.html)
- [Unity 6.6：WebGPU](https://docs.unity3d.com/6000.6/Documentation/Manual/WebGPU.html)
- [Unity 6.6：启用 WebGPU](https://docs.unity3d.com/6000.6/Documentation/Manual/WebGPU-enable.html)
- [Unity 6.6：WebGPU 的限制](https://docs.unity3d.com/6000.6/Documentation/Manual/WebGPU-limitations.html)

## Three.js 主 Demo 的画质升级

主入口 `roadster.html` 继续使用 Three.js WebGL 渲染器；`premium-render.js` 负责摄影棚柔光板生成的 PMREM 环境、矩形面积灯、4× MSAA 的半浮点渲染目标、GTAO 环境遮蔽、轻量 Bloom、色彩调整与 OutputPass。车辆使用局部 2048 × 2048 阴影贴图，外观场景使用经模糊、衰减处理的平面 Reflector。界面提供“精致 / 流畅”切换；流畅模式关闭 GTAO、Bloom 和展台反射，并降低像素比上限。

`vapor-v3.js` 使用 2,600 个喷流粒子和 1,700 个近地白雾粒子。喷流按过去的车辆姿态放置，转动后尾迹仍留在世界空间；精致模式使用深度缓冲柔化与车体、地面的交界。

以上是实时光栅化中的屏幕空间和简化效果：GTAO 依赖当前视角的深度 / 法线，展台反射是单个平面的镜像渲染与模糊，喷流是确定性的噪声粒子密度。它们不是实时路径追踪、完整全局光照或 CFD，不能据此推断实际气体流量、压力或推力。

## 独立 WebGPU / WebGL2 实测

测量记录为 [out/webgpu-probe.json](webgpu-probe.json)，检查脚本为 `webgpu-probe-qa.mjs`。独立入口 [webgpu-probe-roadster.html](webgpu-probe-roadster.html) 使用相同车辆、场地和观察轨迹，以兼容两后端的标准材质与实例化白雾精灵检查实际渲染能力；它不包含主 Demo 的完整后处理和 `vapor-v3.js` GLSL 效果，不能视为相同画质管线的性能对比。

| 检查项 | 已记录结果 |
| --- | --- |
| Three.js 版本 | Revision 170（项目依赖 `0.170.0`）。 |
| 本机 WebGPU 路径 | Chrome 无头检查在安全上下文中实际初始化 `WebGPUBackend` 并完成渲染。适配器报告 `nvidia / lovelace`，`isFallbackAdapter: false`。 |
| 指定 WebGL2 路径 | `?backend=webgl` 实际初始化 `WebGLBackend` 并完成渲染。 |
| 缺少 GPU API 时的回退 | 测试主动将 `navigator.gpu` 置为不可用，WebGPU 请求自动回退到 `WebGLBackend` 并完成渲染。此项是模拟 API 缺失，不是另一台真实设备的检查。 |
| 资产与效果边界 | 三种路径各记录 111 个车辆部件、0 个自定义 ShaderMaterial；白雾使用 CanvasTexture 实例化面片与标准 MeshBasicMaterial。 |
| 关键动作状态 | WebGPU 与 WebGL2 合计检查 30 个时间点，覆盖入场、爬坡、倒挂、返回、离轨、制动、着陆及完整 Kickflip；页面实际位置与姿态符合共享轨迹。 |
| 交互与布局 | 时间线定位、速度切换、模式切换、播放后暂停，以及 390 px WebGPU 布局均通过脚本断言。 |
| 浏览器消息 | 此次记录中 `errors` 与 `warnings` 均为空。 |
| 性能范围 | 此报告内的 `frames` 是已渲染帧计数，不是 FPS；本次独立入口没有进行同画质、跨后端性能比较。主 Demo 的另一次带 GPU 同步采样见下节。 |

上述结果证明本机这次检查可以使用实际 WebGPU 并回退，不代表所有浏览器、设备或整套主 Demo 特效均已验证。公平性能比较还需保持资产、镜头、分辨率、效果设置、时间点和目标设备一致；截图不能单独证明性能提升。

## 主 Demo 带同步的绘制耗时

原始记录为 [out/premium-performance.json](premium-performance.json)，脚本为 `premium-performance.mjs`。本次环境是 Windows 的 HeadlessChrome 155、1440 × 900 视口、像素比 1；WebGL 通过 ANGLE 使用 NVIDIA GeForce RTX 4080 Laptop GPU 的 Direct3D 11 后端，车辆包含 111 个部件。

脚本以 `?film=1` 打开主 Demo，分别设置两档画质及三个观察状态。每组先执行 8 次预热，再采样 40 次 `update(1/60, true)` 与绘制，并在每次绘制后调用 `gl.finish()` 等待 GPU 完成。`performance.now()` 测得的是 CPU 更新、渲染提交和 GPU 同步等待的合计墙钟时间。外观组保持同一时刻；测试组按每次 `i/60` 秒推进，从指定时刻覆盖约 0.65 秒的短窗口。P50 / P95 按脚本排序后索引 20 / 38 读取，以下数值保留两位小数。

| 画质 | 场景与起始时刻 | 样本数 | 平均耗时（ms） | P50（ms） | P95（ms） |
| --- | --- | --- | --- | --- | --- |
| 精致（cinema） | 车辆外观，0 秒 | 40 | 3.45 | 3.30 | 5.90 |
| 精致（cinema） | 完整跑道，24 秒倒挂 | 40 | 1.59 | 1.40 | 2.90 |
| 精致（cinema） | 离轨段，10 秒喷流（完整模式 55 秒） | 40 | 3.94 | 3.30 | 7.00 |
| 流畅（balanced） | 车辆外观，0 秒 | 40 | 0.59 | 0.50 | 1.10 |
| 流畅（balanced） | 完整跑道，24 秒倒挂 | 40 | 0.81 | 0.70 | 1.60 |
| 流畅（balanced） | 离轨段，10 秒喷流（完整模式 55 秒） | 40 | 2.83 | 2.60 | 5.30 |

本次记录未出现页面脚本错误。以上是单台较强 GPU、无头浏览器、短时间窗口的同步绘制采样，不是交互 FPS、持续播放性能、纯 GPU 计时或跨引擎排名；不能将 `1000 / 耗时` 当作实际帧率。启动时间、显存、低端设备表现与长时间稳定性仍未测量。

## 画质前后对照

[quality-comparison.html](quality-comparison.html) 提供同一镜头的车辆外观和完整测试 55 秒喷流截图滑块，便于观察材质高光、接地与白雾的变化。它是静态画质对照，不是性能测量，也不证明实车还原精度或引擎排名。

## 可复用的 Unity URP 迁移资产需求

准备带明确米制比例、轴向和层级的车辆与跑道资产，优先使用可交换的 glTF / FBX；保留四轮、翼片、喷口、玻璃、车壳和内构件的独立名称及正确枢轴。材质需提供基础色、法线、金属度、粗糙度、遮蔽与发光贴图，并在导入 URP 时检查色彩空间与贴图通道转换。将已验证的 `test-sequence.js` 轨迹和遥测导出为带时间戳的数据，保留来源帧与估计字段，再由 Unity 时间线或脚本重放。喷流、地面白雾、照明和镜头作为独立效果层重建，不将 Three.js GLSL 直接当作 URP Shader Graph。网页原型需有 WebGPU 与 WebGL2 两条质量路径、相同的关键帧截图、内存与帧时间记录，以及浏览器交互和离屏导出验证。

以上是迁移输入要求与验证计划，尚未执行迁移。
