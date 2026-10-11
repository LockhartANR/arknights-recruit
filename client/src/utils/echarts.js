// ECharts 按需引入。
//
// 为什么要有这个文件：之前 YearStats.vue / MonthlyStats.vue 各自写
// `import * as echarts from 'echarts'`，即整包引入。echarts 的 node_modules 有
// 62 MB，而页面只用到饼图 —— 柱状图、折线图、地图等全部被打进产物，导致单个
// JS chunk 达 1256 KB（gzip 421 KB），Vite 会就 500 KB 阈值告警。
//
// 改为只注册实际用到的部分，并集中在此处，避免两个组件各自注册造成遗漏或重复。
//
// 当前用到的能力与对应注册项：
//   series type: 'pie'           -> PieChart      （星级分布饼图）
//   series type: 'bar'           -> BarChart      （月度趋势柱状图）
//   grid / xAxis / yAxis         -> GridComponent （柱状图必需，缺了会白屏）
//   tooltip                      -> TooltipComponent
//   legend                       -> LegendComponent
//
// CanvasRenderer 是必需的渲染器（不引入则 init() 无法绘制）。
//
// ⚠️ 新增图表类型时必须在此追加注册项，例如折线图：
//      import { LineChart } from 'echarts/charts'
//      echarts.use([LineChart])
//    漏了不会报错，只是图表区域**一片空白** —— 这是这个文件最容易踩的坑。
//    曾因为只在组件里 import 而忘了在这里 use，导致排查了半天。
import * as echarts from 'echarts/core'
import { PieChart, BarChart } from 'echarts/charts'
import { TooltipComponent, LegendComponent, GridComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'

echarts.use([PieChart, BarChart, TooltipComponent, LegendComponent, GridComponent, CanvasRenderer])

export default echarts
