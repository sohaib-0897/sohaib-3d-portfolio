import { Suspense, useMemo, useRef, useEffect, type MutableRefObject } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { EffectComposer, Bloom, DepthOfField, SMAA } from '@react-three/postprocessing'
import * as THREE from 'three'
import Env from './Env'
import { FOCUS_POINTS, FRAMES_PER_NODE } from '../data/focusPoints'
import type { StoryId } from '../data/stories'
import { useStore } from '../store'
import { hotspotEls, lanyardEls } from './storyAnchors'
import { storyKeys, storyCoord, STORY_END } from '../data/storyScroll'

useGLTF.preload(`${import.meta.env.BASE_URL}models/me.glb`)

// 聚焦锚点（glb 内 focus-* 空对象），顺序对应履历节点；名单是唯一真源，见 data/focusPoints.ts
const POINTS = FOCUS_POINTS as readonly string[]
const M = POINTS.length // 时间轴节点数（= 履历条数），从名单推导，不写死
const RESUME_FRAMES = M * FRAMES_PER_NODE // 履历区帧数：每节点 FRAMES_PER_NODE 帧（节点 k → 第 k·50 帧）
const WORKS_ENTRANCE = 50 // 作品区"入场"（画廊屏幕从底部滑入覆盖）占的帧数
const FPS = 24 // 所有 clip @24fps 共享时间轴；相机动画总帧数运行时从 CameraAction clip 读（见 totalFrames）
const NODE_LINE = 0.3 // 节点"终点"参考线：条目顶部到达视口该高度(从上 30%)时锁定为该节点
const STORY_IDS: StoryId[] = ['watch', 'shoes']
// 角色故事镜头微推（很小）：打开面板时相机沿「目标→相机」方向拉近到原距离的该比例，
// 并轻微转向让目标落在面板外的空区。纯叠加：权重回到 0 时相机就是原作品区相机，分毫不差。
const STORY_CAM = {
  amount: 0.3, // 只走完整「对准目标」的 30%：约近 5%，轻微转向——很小的微推
  zoom: { watch: 0.8, shoes: 0.85 } as Record<StoryId, number>,
  ease: 0.02, // 进出缓动（越小越快）
  desktopX: -0.25, // 桌面：目标略偏左（NDC x），面板停靠右侧；窄屏不微推
  minHit: 22, // 热点最小半径（px）→ 触控目标 ≥ 44px
  maxHit: { watch: 64, shoes: 140 } as Record<StoryId, number>, // 特写时热点最大半尺寸（px），不让命中区铺满半屏
}
// 角色故事滚动段（履历之后、作品之前，节奏见 data/storyScroll.ts）：在作品区全身镜头（第 300 帧）之上
// 叠加三处镜头——手表 / 鞋子 / 胸前工牌。每个镜头 = 从原相机方向靠近目标 + 轻微俯仰/方位 + 让目标落在文案之外。
//   frac：目标半径占「视口较短半边」的比例（越大越近）；x / y：目标在屏幕上的 NDC 位置；
//   elev / azim：相对原相机方向的抬高 / 绕竖轴旋转（度）。窄屏镜头更宽、目标放上方（文案在底部）。
const STORY_SEQ = {
  arc: 0.14, // 手表 → 鞋子途中略微拉远（占距离比例），像镜头下摇而不是直线平移
  arcBadge: 0.18, // 鞋子 → 工牌（上移整段身体）途中略微拉远，不是贴着身体直线上滑
  watch: {
    desktop: { frac: 0.17, x: -0.3, y: 0.02, elev: 4, azim: 0 },
    mobile: { frac: 0.2, x: 0, y: 0.24, elev: 4, azim: 0 },
  },
  shoes: {
    desktop: { frac: 0.52, x: -0.3, y: -0.1, elev: 14, azim: 0 }, // 比 0.46 近约 12%，鞋子略放低
    mobile: { frac: 0.62, x: 0, y: 0.24, elev: 14, azim: 0 },
  },
  // 工牌：保留上半身语境（领口 / 颈部 / 挂绳 / 工牌 / 上衣），不是产品特写；画面上沿切在下巴下方（不切过脸），
  // 窄屏工牌放在上半屏、离底部文案卡片足够远
  badge: {
    desktop: { frac: 0.15, x: -0.4, y: 0.18, elev: 2, azim: 0 },
    mobile: { frac: 0.22, x: 0, y: 0.46, elev: 2, azim: 0 },
  },
}
type StoryPoseId = StoryId | 'badge'
const KEYS = { desktop: storyKeys(false), mobile: storyKeys(true) }
// QA 探针开关：只有 URL 带 ?qa 才写 window.__qa（正常访问不做任何额外计算）
const QA_PROBE = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('qa')
const UP = new THREE.Vector3(0, 1, 0)

// 上下渐变背景球（包裹相机），两端颜色可调
function GradientBackground() {
  // glb 相机视角很窄(~23°)，只看到渐变中间一条；陡度把可见窄带拉伸出完整过渡
  const top = '#6f906f'
  const bottom = '#dbd3b5'
  const steep = 1.4

  const uniforms = useMemo(
    () => ({
      uTop: { value: new THREE.Color() },
      uBottom: { value: new THREE.Color() },
      uSteep: { value: 1 },
    }),
    []
  )
  uniforms.uTop.value.set(top)
  uniforms.uBottom.value.set(bottom)
  uniforms.uSteep.value = steep

  return (
    <mesh scale={100}>
      <sphereGeometry args={[1, 32, 32]} />
      <shaderMaterial
        side={THREE.BackSide}
        depthWrite={false}
        uniforms={uniforms}
        vertexShader={/* glsl */ `
          varying vec3 vDir;
          void main() {
            vDir = normalize(position);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={/* glsl */ `
          uniform vec3 uTop;
          uniform vec3 uBottom;
          uniform float uSteep;
          varying vec3 vDir;
          void main() {
            // 以地平线(y=0)为中心按陡度拉伸，narrow-fov 下也能看到完整过渡
            float t = clamp(vDir.y * uSteep * 0.5 + 0.5, 0.0, 1.0);
            gl_FragColor = vec4(mix(uBottom, uTop, t), 1.0);
          }
        `}
      />
    </mesh>
  )
}

// 所有光源（HDRI 环境 + 半球 + 主/补方向光）
function Lights() {
  const c = {
    envIntensity: 0.85,
    hemiIntensity: 1.15,
    hemiSky: '#ffffff',
    hemiGround: '#404040',
    keyIntensity: 2.35,
    keyColor: '#ffd9c6',
    keyPos: [5, 8, 5] as [number, number, number],
    fillIntensity: 2.25,
    fillColor: '#9fc6ff',
    fillPos: [-5, 4, -4] as [number, number, number],
  }

  return (
    <>
      <Env
        intensity={c.envIntensity}
        rotationX={0}
        rotationY={0}
        rotationZ={0}
        asBackground={false}
        bgIntensity={0.4}
        bgBlur={0}
      />
      <hemisphereLight args={[c.hemiSky, c.hemiGround, c.hemiIntensity]} />
      <directionalLight
        position={c.keyPos}
        intensity={c.keyIntensity}
        color={c.keyColor}
        castShadow
        shadow-mapSize={[2048, 2048]}
      />
      <directionalLight position={c.fillPos} intensity={c.fillIntensity} color={c.fillColor} />
    </>
  )
}

// me.glb：模型 + glb 自带相机动画（滚动分 5 段擦除）+ 自动对焦 + 眼睛跟随
function Man2({
  focusRef,
  frameRef,
  dofBokehRef,
  dofRangeRef,
}: {
  focusRef: MutableRefObject<THREE.Vector3>
  frameRef: MutableRefObject<number>
  dofBokehRef: MutableRefObject<number>
  dofRangeRef: MutableRefObject<number>
}) {
  const posX = 0
  const posY = 0.4
  const posZ = -0.7
  const scale = 2.25
  const rotationY = 0

  // mobilePullback：移动端相机沿「焦点→相机」方向拉远的倍率（1 = 不变，1.2 = 远 20%）
  // mobileTimelineShift：移动端「时间轴阶段」相机水平位移，单位=视距占比（正=左移，负=右移，0=关）
  const cam = {
    damping: 0.1,
    dwell: 0.35,
    parallax: 4,
    parallaxEase: 0.1,
    mobilePullback: 1.2,
    mobileTimelineShift: 0.12,
    // hero-only pull-back about the eye anchor (eyes stay put on screen, the head gets a little smaller so the
    // name sits below the chin instead of across it); fades to 1 before the first résumé stop (s: -1 → -0.45)
    heroPullback: 1.12,
    mobileHeroPullback: 1.2,
  }

  // limitYaw / limitPitch: hard caps (degrees) on the final eye rotation so the eyes look toward the cursor
  // without rolling the iris under the lids; crossEye kept small (a slight convergence, not a cartoon cross-eye).
  const eye = {
    enabled: true,
    gain: 3,
    maxYaw: 15,
    maxPitch: 8,
    limitYaw: 20,
    limitPitch: 11,
    invertX: false,
    invertY: false,
    smooth: 0.3,
    crossEye: 6,
    crossRadius: 0.25,
  }

  const get = useThree((s) => s.get)
  const { scene, animations } = useGLTF(`${import.meta.env.BASE_URL}models/me.glb`)

  // 克隆模型；收集眼睛对象、聚焦锚点对象、glb 自带相机、各锚点景深开关
  const { model, eyes, points, startPoint, glbCam, focusNode, dof, story } = useMemo(() => {
    const clone = scene.clone(true)
    const eyes: any[] = []
    const pmap: Record<string, any> = {}
    let startPoint: any = null
    let glbCam: any = null
    let focusNode: any = null
    // 故事热点锚点：watch_interaction（单位球按手表半径缩放）/ shoes_interaction（单位立方按鞋盒半尺寸缩放）。
    // 旧 glb 没有锚点：手表回退到 watch_left 网格（固定半径），鞋子热点不出现。
    let watchAnchor: any = null
    let watchMesh: any = null
    let shoesAnchor: any = null
    // 胸前工牌网格（career_badge，只在候选 glb 里）：镜头对准其几何包围盒中心，半径 = 包围盒半对角线
    let badge: any = null
    const badgeC = new THREE.Vector3()
    const badgeBox = new THREE.Box3()
    let badgeR = 0
    clone.traverse((o: any) => {
      if (o.isMesh) {
        o.castShadow = true
        o.receiveShadow = true
      }
      if (o.name === 'watch_interaction') watchAnchor = o
      if (o.name === 'watch_left') watchMesh = o
      if (o.name === 'shoes_interaction') shoesAnchor = o
      // 多材质网格在 three 里是一个 Group + 若干子 Mesh（每个 primitive 一个）→ 合并自身与直接子网格的包围盒（工牌本地空间）
      if (o.name === 'career_badge') {
        for (const m of [o, ...o.children]) {
          if (!m.isMesh || !m.geometry) continue
          m.geometry.computeBoundingBox()
          const b = m.geometry.boundingBox.clone()
          if (m !== o) {
            m.updateMatrix()
            b.applyMatrix4(m.matrix)
          }
          badgeBox.union(b)
        }
        if (!badgeBox.isEmpty()) {
          badge = o
          badgeBox.getCenter(badgeC)
          badgeR = badgeBox.getSize(new THREE.Vector3()).length() / 2
        }
      }
      if (o.isCamera) glbCam = o
      // 首页锚点：兼容旧名 focus-start 与 intro3d 统一命名 focus-0
      if (o.name === 'focus-start' || o.name === 'focus-0') startPoint = o
      if (o.name === 'focus-works') focusNode = o
      if (POINTS.includes(o.name)) pmap[o.name] = o
      if (/eye/i.test(o.name)) {
        // 平滑着色：重算平滑顶点法线 + 关闭 flatShading
        if (o.isMesh) {
          o.geometry.computeVertexNormals()
          const mats = Array.isArray(o.material) ? o.material : [o.material]
          mats.forEach((m: any) => {
            m.flatShading = false
            m.needsUpdate = true
          })
        }
        eyes.push({ obj: o, base: o.quaternion.clone(), x: o.position.x })
      }
    })
    // 按本地 x 定左右：最左眼 sx=-1、最右眼 sx=+1，用于斗鸡眼内转方向
    if (eyes.length > 1) {
      const xs = eyes.map((e) => e.x)
      const min = Math.min(...xs)
      const max = Math.max(...xs)
      const mid = (min + max) / 2
      eyes.forEach((e) => {
        e.sx = e.x < mid ? -1 : 1
      })
    } else {
      eyes.forEach((e) => (e.sx = 0))
    }
    const pts = POINTS.map((n) => pmap[n] || null)
    // 作品区锚点：优先 focus-works（旧 glb）；缺省（intro3d 统一命名不导）则复用末时间轴节点 focus-M。
    const works = focusNode || pts[pts.length - 1] || null
    // 首页锚点：focus-start / focus-0；都没有则回退首个时间轴节点。
    const start = startPoint || pts[0] || null
    // 逐锚点景深参数（intro3d 导出写入 userData/extras）：dofBokeh 虚化强度、dofFocusRange 清晰范围、
    // dofEnabled 开关（关→有效 bokeh 记 0）。has=false（老 glb 无这些字段）→ Post2 走原全局帧混合，行为不变。
    const ud = (o: any): any => o?.userData ?? {}
    const hasDofParams = [...pts, start, works].some((o) => ud(o).dofBokeh !== undefined)
    const effBokeh = (o: any): number => (ud(o).dofEnabled === false ? 0 : (ud(o).dofBokeh ?? 0))
    const effRange = (o: any): number => ud(o).dofFocusRange ?? 0
    return {
      model: clone,
      eyes,
      points: pts,
      startPoint: start,
      glbCam,
      focusNode: works,
      dof: {
        has: hasDofParams,
        bokeh: pts.map(effBokeh),
        range: pts.map(effRange),
        startBokeh: effBokeh(start),
        startRange: effRange(start),
        worksBokeh: effBokeh(works),
        worksRange: effRange(works),
      },
      story: {
        watch: watchAnchor || watchMesh,
        shoes: shoesAnchor,
        // 锚点的世界缩放 = 命中半径；回退到网格时用固定的模型空间半径
        watchUnit: !!watchAnchor,
        badge,
        badgeC,
        badgeR,
        badgeBox,
      } as {
        watch: any
        shoes: any
        watchUnit: boolean
        badge: any
        badgeC: THREE.Vector3
        badgeR: number
        badgeBox: THREE.Box3
      },
    }
  }, [scene])

  // 相机动画总帧数：从 CameraAction clip 读（回退到最长 clip / 默认履历+入场+横移），不写死。
  // 作品区帧段 = [RESUME_FRAMES, totalFrames]，长度随 glb 而定（当前 me.glb 为 100 帧）。
  const totalFrames = useMemo(() => {
    const clips: any[] = animations || []
    const cam = clips.find((c: any) => c.name === 'CameraAction')
    const clip = cam || (clips.length ? clips.reduce((a, b) => (b.duration > a.duration ? b : a)) : null)
    return clip ? Math.round(clip.duration * FPS) : RESUME_FRAMES + 2 * WORKS_ENTRANCE
  }, [animations])

  // 动画混合器：把全部 clip（manAction + CameraAction）都挂上，逐帧设 time + update(0) 擦除
  const mixer = useMemo(() => new THREE.AnimationMixer(model), [model])
  const actions = useRef<any[]>([])
  useEffect(() => {
    if (!animations || animations.length === 0) return
    mixer.stopAllAction()
    actions.current = animations.map((clip) => {
      const a = mixer.clipAction(clip)
      a.play()
      a.paused = true
      return { action: a, duration: clip.duration }
    })
    return () => {
      mixer.stopAllAction()
      actions.current = []
    }
  }, [mixer, animations])

  // 不切换激活相机（避免后处理 CoC 缓存旧相机 near/far 导致整体糊）。
  // 改为每帧把 glb 相机的世界变换 + fov 拷到默认相机上。

  // window 级鼠标输入（smouse 为缓动后的值）
  const mouse = useRef({ x: 0, y: 0 })
  const smouse = useRef({ x: 0, y: 0 })
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      mouse.current.x = (e.clientX / window.innerWidth) * 2 - 1
      mouse.current.y = -((e.clientY / window.innerHeight) * 2 - 1)
    }
    window.addEventListener('mousemove', onMove)
    return () => window.removeEventListener('mousemove', onMove)
  }, [])

  // 移动端 / 触屏（无鼠标可跟随）：关闭眼睛跟随，眼睛保持默认朝向。
  // 判定 = 触屏指针 或 窄视口（≤640px，与移动端样式断点一致）。
  const isMobile = useRef(
    typeof window !== 'undefined' &&
      (window.matchMedia?.('(pointer: coarse)').matches === true ||
        window.innerWidth <= 640)
  )

  // 履历锚点 DOM 元素（决定当前播放到第几段）
  const anchorEls = useRef<any>(null)
  // 作品区画廊 DOM 元素（决定作品入场 / 横移阶段的帧）
  const galleryEl = useRef<any>(null)

  // 复用对象，避免每帧分配
  const frameSmooth = useRef(0)
  const posA = useRef(new THREE.Vector3())
  const posB = useRef(new THREE.Vector3())

  const tmpEuler = useRef(new THREE.Euler(0, 0, 0, 'YXZ'))
  const tmpQuat = useRef(new THREE.Quaternion())
  const desiredQuat = useRef(new THREE.Quaternion())
  const tmpVec = useRef(new THREE.Vector3())

  // 拷贝 glb 相机世界变换用
  const camPos = useRef(new THREE.Vector3())
  const camQuat = useRef(new THREE.Quaternion())
  const camScl = useRef(new THREE.Vector3())
  const paraEuler = useRef(new THREE.Euler(0, 0, 0, 'YXZ'))
  const paraQuat = useRef(new THREE.Quaternion())

  // 角色故事：镜头微推权重 + 复用对象；热点遮挡检测用的作品卡片 DOM
  const storyW = useRef(0)
  const storyTarget = useRef<StoryId | null>(null)
  const reduceMotion = useRef(
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
  )
  const cardEls = useRef<Element[] | null>(null)
  const sv = useRef({
    tgt: new THREE.Vector3(),
    dir: new THREE.Vector3(),
    pos: new THREE.Vector3(),
    basePos: new THREE.Vector3(),
    baseQuat: new THREE.Quaternion(),
    quat: new THREE.Quaternion(),
    off: new THREE.Quaternion(),
    euler: new THREE.Euler(0, 0, 0, 'YXZ'),
    mat: new THREE.Matrix4(),
    p: new THREE.Vector3(),
    right: new THREE.Vector3(),
    scl: new THREE.Vector3(),
  })
  // 故事滚动段：段 DOM、阻尼后的故事坐标 c、两个关键镜头 + 基准镜头的复用对象
  const storyEl = useRef<any>(null)
  const storyC = useRef(0)
  const mkPose = () => ({ pos: new THREE.Vector3(), quat: new THREE.Quaternion(), tgt: new THREE.Vector3() })
  const sq = useRef({ a: mkPose(), b: mkPose(), base: mkPose(), dir: new THREE.Vector3(), axis: new THREE.Vector3() })

  useFrame((_, dt) => {
    const a = 1 - Math.pow(cam.damping, dt)

    // 1) 由履历锚点（文档坐标）算连续索引 s：
    //    顶部 s≈-1，focus-1 居中 s=0，focus-2=1 … focus-5=4
    if (!anchorEls.current) {
      anchorEls.current = POINTS.map((n) => document.querySelector(`[data-point="${n}"]`))
    }
    const els = anchorEls.current
    // 节点停顿：对每段滚动做停顿重映射——靠近某节点的一段滚动里 s 保持不变（停顿），
    // 段中部快速过渡到下一节点。只改"滚动→s"的节奏，glb 动画仍是 s 的线性函数。
    const d = THREE.MathUtils.clamp(cam.dwell, 0, 0.49)
    const dwell = (t: number) => {
      if (d <= 0) return t
      if (t < d) return 0
      if (t > 1 - d) return 1
      return THREE.MathUtils.smoothstep((t - d) / (1 - 2 * d), 0, 1)
    }
    let sTarget = THREE.MathUtils.clamp(frameSmooth.current / FRAMES_PER_NODE - 1, -1, M - 1)
    if (els && els.length === M && els.every(Boolean)) {
      // 参考线在视口 NODE_LINE 高度；锚点用条目顶部（文字位置，不含底部大 padding）
      const refLine = window.scrollY + window.innerHeight * NODE_LINE
      const tops = els.map((el: any) => el.getBoundingClientRect().top + window.scrollY)
      if (refLine <= tops[0]) {
        // 顶部 → sysu 的渐入段：scrollY=0 时 s=-1（第 0 帧），sysu 到达参考线时 s=0
        const heroScroll = Math.max(1, tops[0] - window.innerHeight * NODE_LINE)
        sTarget = -1 + dwell(THREE.MathUtils.clamp(window.scrollY / heroScroll, 0, 1))
      } else if (refLine >= tops[M - 1]) {
        sTarget = M - 1
      } else {
        for (let i = 0; i < M - 1; i++) {
          if (refLine <= tops[i + 1]) {
            const t = (refLine - tops[i]) / Math.max(1, tops[i + 1] - tops[i])
            sTarget = i + dwell(t)
            break
          }
        }
      }
    }
    // 2) 帧驱动：先算"目标帧"（履历/作品统一，交界处两侧都是 RESUME_FRAMES → 连续），
    //    再对最终帧做一次缓动——避免之前"平滑 s + 直读 rectTop"两路径不一致导致的瞬跳。
    //    履历区 0–RESUME_FRAMES（节点 i→(i+1)·50）；作品区 = 入场（屏幕滑入）+ 首板块横移，直到末帧
    let frameTarget = THREE.MathUtils.clamp((sTarget + 1) * FRAMES_PER_NODE, 0, RESUME_FRAMES)
    let inWorks = false
    // 入场段结束帧（全身镜头）：履历末尾 + 入场帧数，钳到总帧
    const entranceEnd = Math.min(RESUME_FRAMES + WORKS_ENTRANCE, totalFrames)
    // 2a) 角色故事滚动段（履历之后）：全身揭示 = 第 250→300 帧（原本由画廊进场驱动）；之后定格 300 帧，
    //     手表 / 鞋子镜头在第 5a 步叠加。段进度 storyP：段顶在视口底 → 0，段底在视口底 → 1。
    const narrowView = window.innerWidth <= 640
    const sk = narrowView ? KEYS.mobile : KEYS.desktop
    if (!storyEl.current) storyEl.current = document.querySelector('.story-scroll')
    const hasStory = !!storyEl.current
    let storyP = -1
    if (hasStory && storyEl.current.offsetHeight > 0) {
      storyP = (window.innerHeight - storyEl.current.getBoundingClientRect().top) / storyEl.current.offsetHeight
    }
    if (hasStory && storyP > 0) {
      inWorks = true
      const pR = THREE.MathUtils.clamp(storyP / sk.k[1], 0, 1)
      frameTarget = RESUME_FRAMES + (entranceEnd - RESUME_FRAMES) * pR
    }
    if (!galleryEl.current) galleryEl.current = document.querySelector('.wk-gallery')
    if (galleryEl.current) {
      const ih = window.innerHeight
      const rectTop = galleryEl.current.getBoundingClientRect().top
      const range = Math.max(0, galleryEl.current.offsetHeight - ih)
      if (rectTop < ih) {
        inWorks = true
        if (rectTop > 0) {
          // 作品屏幕从底部(rectTop=ih)滑到完全覆盖(rectTop=0)：入场帧段。
          // 有故事段时全身揭示已在段内完成 → 这里保持全身镜头。
          const pA = THREE.MathUtils.clamp(1 - rectTop / ih, 0, 1)
          frameTarget = hasStory ? entranceEnd : RESUME_FRAMES + (entranceEnd - RESUME_FRAMES) * pA
        } else {
          // 已钉住，首板块水平移入（前一整屏 100vw 横移）：入场结束 → 末帧，之后定格末帧
          // 竖滚与横移 1:1（px）；横移 100vw = innerWidth px
          const scrolled = THREE.MathUtils.clamp(-rectTop, 0, range)
          const pB = THREE.MathUtils.clamp(scrolled / window.innerWidth, 0, 1)
          frameTarget = entranceEnd + (totalFrames - entranceEnd) * pB
        }
      }
    }
    // 缓动程度随目标帧过渡：≤RESUME_FRAMES 正常平滑；入场段渐关；入场后 a=1（直接跟手、无 smooth）
    const smoothOff = THREE.MathUtils.smoothstep(frameTarget, RESUME_FRAMES, RESUME_FRAMES + WORKS_ENTRANCE)
    const aEff = THREE.MathUtils.lerp(a, 1, smoothOff)
    frameSmooth.current += (frameTarget - frameSmooth.current) * aEff
    const frame = frameSmooth.current
    // 所有 clip 共享时间轴：time = frame/FPS，各自钳到自身时长
    // （较短的 clip 播完后保持末帧，相机 clip CameraAction 走满 totalFrames）
    if (actions.current.length) {
      const t = frame / FPS
      for (const { action: act, duration } of actions.current) {
        act.time = Math.min(t, duration)
      }
      mixer.update(0)
    }
    if (frameRef) frameRef.current = frame

    // 履历段用于对焦的连续索引：由平滑后的帧反推，确保对焦与镜头同步
    const s = THREE.MathUtils.clamp(frame / FRAMES_PER_NODE - 1, -1, M - 1)

    // 3) 自动对焦：作品区跟随 glb focus-works 空对象；履历区按 focus 锚点插值
    //    （在 mixer.update 之后取世界坐标，保证与当前帧一致）
    if (focusRef) {
      if (inWorks && focusNode) {
        focusNode.getWorldPosition(focusRef.current)
      } else if (s < 0 && startPoint && points[0]) {
        startPoint.getWorldPosition(posA.current)
        points[0].getWorldPosition(posB.current)
        focusRef.current.lerpVectors(posA.current, posB.current, THREE.MathUtils.clamp(s + 1, 0, 1))
      } else {
        const sc = THREE.MathUtils.clamp(s, 0, M - 1)
        const iA = Math.floor(sc)
        const iB = Math.min(iA + 1, M - 1)
        const f = sc - iA
        if (points[iA] && points[iB]) {
          points[iA].getWorldPosition(posA.current)
          points[iB].getWorldPosition(posB.current)
          focusRef.current.lerpVectors(posA.current, posB.current, f)
        }
      }
    }

    // 3b) 景深：glb 带逐锚点参数（intro3d 导出）时，沿当前连续索引在相邻锚点间插值 bokeh/focusRange，
    //     写入 refs 供 Post2 直接采用（忠实还原 intro3d）；无参数（老 glb）则写哨兵 -1 → Post2 走原全局帧混合。
    if (dofBokehRef && dofRangeRef) {
      if (!dof.has) {
        dofBokehRef.current = -1
      } else {
        const sample = (arr: number[], sv: number, wv: number): number => {
          if (inWorks) return wv
          if (s < 0) return THREE.MathUtils.lerp(sv, arr[0] ?? sv, THREE.MathUtils.clamp(s + 1, 0, 1))
          const sc = THREE.MathUtils.clamp(s, 0, M - 1)
          const iA = Math.floor(sc)
          const iB = Math.min(iA + 1, M - 1)
          return THREE.MathUtils.lerp(arr[iA] ?? 0, arr[iB] ?? 0, sc - iA)
        }
        dofBokehRef.current = sample(dof.bokeh, dof.startBokeh, dof.worksBokeh)
        // focusRange 按模型 group 缩放折算到世界单位（scene 被放大 scale 倍，清晰范围需同比放大才与 intro3d 观感一致）。
        dofRangeRef.current = sample(dof.range, dof.startRange, dof.worksRange) * scale
      }
    }

    // 2b) 拷贝 glb 相机世界变换到默认相机，并绕焦点做轨道式鼠标视差（焦点屏幕位置不变）
    const camera: any = get().camera
    if (glbCam && camera.isPerspectiveCamera) {
      glbCam.updateWorldMatrix(true, false)
      glbCam.matrixWorld.decompose(camPos.current, camQuat.current, camScl.current)
      // 鼠标缓动：无限趋近目标值
      const me = 1 - Math.pow(cam.parallaxEase, dt)
      smouse.current.x += (mouse.current.x - smouse.current.x) * me
      smouse.current.y += (mouse.current.y - smouse.current.y) * me
      const ax = THREE.MathUtils.degToRad(cam.parallax)
      paraEuler.current.set(-smouse.current.y * ax, -smouse.current.x * ax, 0)
      paraQuat.current.setFromEuler(paraEuler.current)
      // 绕焦点旋转相机位置 + 同步旋转朝向 → 焦点不动，仅四周产生视差
      tmpVec.current
        .copy(camPos.current)
        .sub(focusRef.current)
        .applyQuaternion(paraQuat.current)
      // 移动端沿「焦点→相机」方向整体拉远：焦点屏幕位置不变，主体更小、留白更多
      if (isMobile.current) tmpVec.current.multiplyScalar(cam.mobilePullback)
      const heroW = 1 - THREE.MathUtils.smoothstep(s, -1, -0.45)
      if (heroW > 0) {
        const pull = isMobile.current ? cam.mobileHeroPullback : cam.heroPullback
        tmpVec.current.multiplyScalar(THREE.MathUtils.lerp(1, pull, heroW))
      }
      tmpVec.current.add(focusRef.current)
      camera.position.copy(tmpVec.current)
      camera.quaternion.multiplyQuaternions(paraQuat.current, camQuat.current)
      // 移动端「时间轴阶段」把镜头整体左移，让主体从满宽文字后错开。
      // 权重：从 Hero 渐入(s: -0.8→0.3)、进入作品区随 smoothOff 渐出 → 无跳变。
      if (isMobile.current && cam.mobileTimelineShift !== 0) {
        const tlWeight = THREE.MathUtils.smoothstep(s, -0.8, 0.3) * (1 - smoothOff)
        if (tlWeight > 0) {
          // translateX 沿局部 +X（屏幕右）；取负 → 相机左移
          const dist = camera.position.distanceTo(focusRef.current)
          camera.translateX(-dist * cam.mobileTimelineShift * tlWeight)
        }
      }
      if (camera.fov !== glbCam.fov) {
        camera.fov = glbCam.fov
        camera.updateProjectionMatrix()
      }
    }

    // 5a) 角色故事滚动段的叠加镜头。故事坐标 c：0 全身 → 1 手表 → 2 鞋子 → 3 工牌 → 4 全身（0 与 4 = 原相机，不叠加）。
    //     c 随滚动阻尼趋近目标，关键镜头之间 smootherstep 缓动；减少动态效果时直接切到最近的稳定构图。
    //     与第 5 步一样只叠加在算好的相机之上：不改 CameraAction / 履历帧 / 作品区镜头。
    const cTarget = hasStory && storyP > 0 ? storyCoord(Math.min(storyP, 1), sk.k) : 0
    if (reduceMotion.current) storyC.current = Math.round(cTarget)
    else {
      // 大跳（拖滚动条 / 刷新到作品区）：先跳到距目标一个镜头处，只缓动最后一段，不把整段飞一遍
      const gap = cTarget - storyC.current
      if (Math.abs(gap) > 1.5) storyC.current = cTarget - Math.sign(gap)
      storyC.current += (cTarget - storyC.current) * a
      if (Math.abs(cTarget - storyC.current) < 1e-4) storyC.current = cTarget
    }
    const sc = storyC.current
    const v = sv.current
    // 热点分区：手表镜头附近只露手表热点，鞋子镜头附近只露鞋子热点，工牌镜头附近两个都不露
    const storyZone: StoryPoseId | null =
      sc > 0.5 && sc < 1.5 ? 'watch' : sc >= 1.5 && sc < 2.5 ? 'shoes' : sc >= 2.5 && sc < 3.5 ? 'badge' : null
    if (sc > 0 && sc < STORY_END && glbCam && camera.isPerspectiveCamera) {
      const q = sq.current
      q.base.pos.copy(camera.position)
      q.base.quat.copy(camera.quaternion)
      q.base.tgt.copy(focusRef.current)
      const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)
      const tanH = tanV * camera.aspect
      // key: 0 / 4 = 基准镜头；1 = 手表；2 = 鞋子；3 = 工牌（无锚点的旧 glb → 基准）
      const pose = (key: number, out: typeof q.a) => {
        const id: StoryPoseId | null = key === 1 ? 'watch' : key === 2 ? 'shoes' : key === 3 ? 'badge' : null
        const obj = id ? story[id] : null
        if (!id || !obj) {
          out.pos.copy(q.base.pos)
          out.quat.copy(q.base.quat)
          out.tgt.copy(q.base.tgt)
          return
        }
        const cfg = STORY_SEQ[id][narrowView ? 'mobile' : 'desktop']
        obj.updateWorldMatrix(true, false)
        obj.getWorldScale(v.scl)
        let r: number
        if (id === 'badge') {
          out.tgt.copy(story.badgeC).applyMatrix4(obj.matrixWorld)
          r = story.badgeR * v.scl.x
        } else {
          obj.getWorldPosition(out.tgt)
          r = id === 'watch' ? (story.watchUnit ? v.scl.x : 0.17 * v.scl.x) : v.scl.length()
        }
        q.dir.copy(q.base.pos).sub(out.tgt)
        const baseDist = q.dir.length()
        q.dir.normalize()
        if (cfg.azim) q.dir.applyAxisAngle(UP, THREE.MathUtils.degToRad(cfg.azim))
        if (cfg.elev) {
          q.axis.crossVectors(q.dir, UP).normalize()
          q.dir.applyAxisAngle(q.axis, THREE.MathUtils.degToRad(cfg.elev))
        }
        const dist = Math.min(baseDist, r / (cfg.frac * Math.min(tanV, tanH)))
        out.pos.copy(out.tgt).addScaledVector(q.dir, dist)
        v.mat.lookAt(out.pos, out.tgt, camera.up)
        out.quat.setFromRotationMatrix(v.mat)
        v.euler.set(-Math.atan(cfg.y * tanV), Math.atan(cfg.x * tanH), 0, 'YXZ')
        out.quat.multiply(v.off.setFromEuler(v.euler))
      }
      const i = Math.min(STORY_END - 1, Math.floor(sc))
      const t = THREE.MathUtils.smootherstep(sc - i, 0, 1)
      pose(i, q.a)
      pose(i + 1, q.b)
      camera.position.lerpVectors(q.a.pos, q.b.pos, t)
      camera.quaternion.slerpQuaternions(q.a.quat, q.b.quat, t)
      focusRef.current.lerpVectors(q.a.tgt, q.b.tgt, t)
      // 手表 → 鞋子 / 鞋子 → 工牌：途中沿「焦点→相机」略微拉远，两端为 0
      const arc = i === 1 ? STORY_SEQ.arc : i === 2 ? STORY_SEQ.arcBadge : 0
      if (arc > 0) {
        q.dir.copy(camera.position).sub(focusRef.current)
        camera.position.addScaledVector(q.dir, arc * Math.sin(Math.PI * t))
      }
    }

    // 5) 角色故事（手表 / 鞋子）。只叠加在上面算好的相机之上，权重为 0 时与原行为完全一致；
    //    不改 CameraAction，也不改任何履历帧。
    const storyNow = useStore.getState().story
    if (storyNow) storyTarget.current = storyNow
    // 窄屏不微推：底部抽屉盖住下半屏，小幅微推带不来可见收益，只增加运动 → 镜头保持静止
    const wantW = storyNow && story[storyNow] && !reduceMotion.current && !narrowView ? 1 : 0
    storyW.current += (wantW - storyW.current) * (1 - Math.pow(STORY_CAM.ease, dt))
    if (wantW === 0 && storyW.current < 1e-3) storyW.current = 0
    const tgtObj = storyTarget.current ? story[storyTarget.current] : null
    if (storyW.current > 0 && tgtObj && camera.isPerspectiveCamera) {
      const w = THREE.MathUtils.smootherstep(storyW.current, 0, 1) * STORY_CAM.amount
      tgtObj.getWorldPosition(v.tgt)
      v.basePos.copy(camera.position)
      v.baseQuat.copy(camera.quaternion)
      v.dir.copy(camera.position).sub(v.tgt)
      const dist = v.dir.length()
      v.dir.normalize()
      v.pos.copy(v.tgt).addScaledVector(v.dir, dist * STORY_CAM.zoom[storyTarget.current as StoryId])
      v.mat.lookAt(v.pos, v.tgt, camera.up)
      v.quat.setFromRotationMatrix(v.mat)
      // 目标略偏向面板之外（桌面面板在右 → 偏左）
      const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)
      const tanH = tanV * camera.aspect
      v.euler.set(0, Math.atan(STORY_CAM.desktopX * tanH), 0, 'YXZ')
      v.quat.multiply(v.off.setFromEuler(v.euler))
      camera.position.lerpVectors(v.basePos, v.pos, w)
      camera.quaternion.slerpQuaternions(v.baseQuat, v.quat, w)
      if (focusRef) focusRef.current.lerp(v.tgt, w) // 景深对到手表 / 鞋子
    }

    // 6) DOM 热点：把锚点投影到屏幕，直接写到按钮的 style 上（事件驱动点击，无射线检测）。
    //    只在作品区全身镜头（转身结束后）出现；与作品卡片重叠、面板打开或镜头微推中时隐藏。
    const showPhase =
      inWorks &&
      frame >= RESUME_FRAMES + WORKS_ENTRANCE - 4 &&
      !storyNow &&
      !useStore.getState().contact &&
      storyW.current === 0
    if (showPhase && !cardEls.current) cardEls.current = Array.from(document.querySelectorAll('.wk-card'))
    if (showPhase) camera.updateMatrixWorld()
    // 用画布自身的 CSS 尺寸 / 偏移（不是 window.innerWidth——那会把滚动条宽度算进去导致热点偏移；与 DPR 无关）
    const cs = get().size
    const vw = cs.width
    const vh = cs.height
    const ox = cs.left || 0
    const oy = cs.top || 0
    for (const id of STORY_IDS) {
      const el = hotspotEls[id]
      if (!el) continue
      const obj = story[id]
      let vis = false
      if (showPhase && obj && (!storyZone || storyZone === id)) {
        obj.updateWorldMatrix(true, false)
        let x0 = Infinity
        let y0 = Infinity
        let x1 = -Infinity
        let y1 = -Infinity
        let inFront = true
        // 锚点在相机后方（相机空间 z ≥ 0）→ 隐藏
        obj.getWorldPosition(v.tgt)
        if (v.p.copy(v.tgt).applyMatrix4(camera.matrixWorldInverse).z >= -camera.near) inFront = false
        if (id === 'shoes') {
          // 单位立方的 8 个角 → 屏幕包围盒
          for (let k = 0; k < 8; k++) {
            v.p.set(k & 1 ? 1 : -1, k & 2 ? 1 : -1, k & 4 ? 1 : -1).applyMatrix4(obj.matrixWorld).project(camera)
            x0 = Math.min(x0, v.p.x)
            x1 = Math.max(x1, v.p.x)
            y0 = Math.min(y0, v.p.y)
            y1 = Math.max(y1, v.p.y)
          }
        } else {
          // 球心 + 相机右向偏移一个半径 → 屏幕半径
          obj.getWorldScale(v.scl)
          const r = story.watchUnit ? v.scl.x : 0.17 * v.scl.x
          v.right.setFromMatrixColumn(camera.matrixWorld, 0)
          v.p.copy(v.tgt).addScaledVector(v.right, r).project(camera)
          const ex = v.p.x
          v.p.copy(v.tgt).project(camera)
          const rx = Math.abs(ex - v.p.x)
          const ry = rx * camera.aspect
          x0 = v.p.x - rx
          x1 = v.p.x + rx
          y0 = v.p.y - ry
          y1 = v.p.y + ry
        }
        // NDC → 视口 CSS px（加画布偏移）
        const cx = ox + ((x0 + x1) / 2 + 1) * 0.5 * vw
        const cy = oy + (1 - (y0 + y1) / 2) * 0.5 * vh
        const cap = STORY_CAM.maxHit[id]
        const hw = Math.min(cap, Math.max(STORY_CAM.minHit, ((x1 - x0) / 2) * 0.5 * vw))
        const hh = Math.min(cap, Math.max(STORY_CAM.minHit, ((y1 - y0) / 2) * 0.5 * vh))
        // 视口外（中心或整块命中区越界）→ 隐藏
        vis = inFront && cx - hw > ox && cx + hw < ox + vw && cy - hh > oy && cy + hh < oy + vh
        if (vis && cardEls.current) {
          for (const c of cardEls.current) {
            const b = c.getBoundingClientRect()
            if (cx + hw > b.left && cx - hw < b.right && cy + hh > b.top && cy - hh < b.bottom) {
              vis = false
              break
            }
          }
        }
        if (vis) {
          el.style.transform = `translate3d(${(cx - hw).toFixed(1)}px, ${(cy - hh).toFixed(1)}px, 0)`
          el.style.width = `${(hw * 2).toFixed(1)}px`
          el.style.height = `${(hh * 2).toFixed(1)}px`
        }
      }
      const flag = vis ? '1' : '0'
      if (el.dataset.visible !== flag) el.dataset.visible = flag
      // 在自己的故事镜头里略微强调
      const emph = storyZone === id ? '1' : '0'
      if (el.dataset.emph !== emph) el.dataset.emph = emph
    }

    // 6b) Project the existing badge bounds for credentials; ?qa also exposes the read-only rect.
    const lanyard = lanyardEls.trigger
    const showLanyard = storyZone === 'badge' && !storyNow && !useStore.getState().contact
    if (lanyard && !showLanyard && lanyard.dataset.visible !== '0') lanyard.dataset.visible = '0'
    if ((QA_PROBE || (lanyard && showLanyard)) && story.badge) {
      camera.updateMatrixWorld()
      const bb = story.badgeBox
      story.badge.updateWorldMatrix(true, false)
      let x0 = Infinity
      let y0 = Infinity
      let x1 = -Infinity
      let y1 = -Infinity
      for (let k = 0; k < 8; k++) {
        v.p.set(k & 1 ? bb.max.x : bb.min.x, k & 2 ? bb.max.y : bb.min.y, k & 4 ? bb.max.z : bb.min.z)
        v.p.applyMatrix4(story.badge.matrixWorld).project(camera)
        x0 = Math.min(x0, v.p.x)
        x1 = Math.max(x1, v.p.x)
        y0 = Math.min(y0, v.p.y)
        y1 = Math.max(y1, v.p.y)
      }
      const badgeRect = {
        left: ox + (x0 + 1) * 0.5 * vw,
        right: ox + (x1 + 1) * 0.5 * vw,
        top: oy + (1 - y1) * 0.5 * vh,
        bottom: oy + (1 - y0) * 0.5 * vh,
      }
      if (lanyard && showLanyard) {
        const width = Math.max(44, badgeRect.right - badgeRect.left)
        const height = Math.max(44, badgeRect.bottom - badgeRect.top)
        const left = (badgeRect.left + badgeRect.right - width) / 2
        const top = (badgeRect.top + badgeRect.bottom - height) / 2
        lanyard.style.transform = `translate3d(${left}px, ${top}px, 0)`
        lanyard.style.width = `${width}px`
        lanyard.style.height = `${height}px`
        const visible = left >= ox && top >= oy && left + width <= ox + vw && top + height <= oy + vh ? '1' : '0'
        if (lanyard.dataset.visible !== visible) lanyard.dataset.visible = visible
      }
      if (QA_PROBE) (window as any).__qa = {
        c: sc,
        badge: badgeRect,
      }
    }

    // 4) 眼睛跟随（用当前激活相机做屏幕投影）；移动端 / 触屏则跳过
    if (!eye.enabled || eyes.length === 0 || isMobile.current) return
    const sx = eye.invertX ? -1 : 1
    const sy = eye.invertY ? -1 : 1

    let ax = 0
    let ay = 0
    for (const e of eyes) {
      e.obj.getWorldPosition(tmpVec.current).project(camera)
      ax += tmpVec.current.x
      ay += tmpVec.current.y
    }
    ax /= eyes.length
    ay /= eyes.length

    const mx = mouse.current.x - ax
    const my = mouse.current.y - ay
    const yawLim = THREE.MathUtils.degToRad(eye.limitYaw)
    const pitchLim = THREE.MathUtils.degToRad(eye.limitPitch)
    const yawBase = THREE.MathUtils.clamp(sx * mx * THREE.MathUtils.degToRad(eye.maxYaw) * eye.gain, -yawLim, yawLim)
    const pitch = THREE.MathUtils.clamp(sy * -my * THREE.MathUtils.degToRad(eye.maxPitch) * eye.gain, -pitchLim, pitchLim)

    const dist = Math.hypot(mx, my)
    const convWeight = THREE.MathUtils.clamp(1 - dist / eye.crossRadius, 0, 1)
    const convRad = THREE.MathUtils.degToRad(eye.crossEye) * convWeight

    for (const e of eyes) {
      const yaw = yawBase - e.sx * convRad
      tmpEuler.current.set(pitch, yaw, 0)
      tmpQuat.current.setFromEuler(tmpEuler.current)
      desiredQuat.current.copy(tmpQuat.current).multiply(e.base)
      e.obj.quaternion.slerp(desiredQuat.current, eye.smooth)
    }
  })

  return (
    <group
      position={[posX, posY, posZ]}
      rotation={[0, (rotationY * Math.PI) / 180, 0]}
      scale={scale}
    >
      <primitive object={model} />
    </group>
  )
}

// 后处理：DepthOfField → Bloom → SMAA。
// DoF 焦点逐帧跟随 focusRef（自动对焦）；30–220 帧间收紧清晰范围、加大虚化。
function Post2({
  focusRef,
  frameRef,
  dofBokehRef,
  dofRangeRef,
}: {
  focusRef: MutableRefObject<THREE.Vector3>
  frameRef: MutableRefObject<number>
  dofBokehRef: MutableRefObject<number>
  dofRangeRef: MutableRefObject<number>
}) {
  const post = {
    bloomIntensity: 0.6,
    bloomThreshold: 0.82,
    dof: true,
    startBokeh: 7.4,
    startRange: 2.0,
    focusBokeh: 11.0,
    focusRange: 0.15,
    startBlendFrame: 48,
    endBlendFrame: RESUME_FRAMES - 50, // 末节点附近回到"起始帧"景深档（原 250−50=200）
  }

  const dofRef = useRef<any>(null)
  useFrame(() => {
    const e = dofRef.current
    if (!e) return
    if (e.target && focusRef) e.target.copy(focusRef.current)
    // 权重 w=1 用"开始帧档"，w=0 用"聚焦点档"。
    // 开头(f→0)和末节点(f→RESUME_FRAMES)都取开始帧档；中间各节点取聚焦点档。
    const f = frameRef ? frameRef.current : 0
    const wStart = 1 - THREE.MathUtils.smoothstep(f, 0, post.startBlendFrame)
    const wEnd = THREE.MathUtils.smoothstep(f, post.endBlendFrame, RESUME_FRAMES)
    const w = Math.max(wStart, wEnd)
    if (dofBokehRef && dofBokehRef.current >= 0) {
      // glb 自带逐锚点景深参数（intro3d 导出）：直接采用，忠实还原 intro3d 的虚化强度/清晰范围（bokeh=0 即该点关景深）。
      e.bokehScale = dofBokehRef.current
      if (e.cocMaterial) e.cocMaterial.focusRange = Math.max(1e-4, dofRangeRef ? dofRangeRef.current : post.focusRange)
    } else {
      // 老 glb（无逐锚点参数）：沿用原全局帧混合档位。
      e.bokehScale = THREE.MathUtils.lerp(post.focusBokeh, post.startBokeh, w)
      if (e.cocMaterial) e.cocMaterial.focusRange = THREE.MathUtils.lerp(post.focusRange, post.startRange, w)
    }
  })

  return (
    <EffectComposer multisampling={0} stencilBuffer={false} depthBuffer>
      {(post.dof ? (
        <DepthOfField
          ref={dofRef}
          target={[0, 1.3, 0]}
          worldFocusRange={post.focusRange}
          bokehScale={post.focusBokeh}
          height={480}
        />
      ) : null) as any}
      <Bloom
        mipmapBlur
        intensity={post.bloomIntensity}
        luminanceThreshold={post.bloomThreshold}
        luminanceSmoothing={0.3}
      />
      <SMAA />
    </EffectComposer>
  )
}

// 场景根组件：展示 me.glb（相机由 glb 动画 + 滚动驱动）
export default function Scene() {
  const focusRef = useRef(new THREE.Vector3(0, 1.3, 0))
  const frameRef = useRef(0)
  // 逐锚点景深（intro3d 导出的 glb 携带）：Man2 每帧写、Post2 读。dofBokeh=-1 表示无参数 → Post2 走旧全局混合。
  const dofBokehRef = useRef(-1)
  const dofRangeRef = useRef(0.15)
  return (
    <>
      <GradientBackground />

      <Suspense fallback={null}>
        <Lights />
        <Man2 focusRef={focusRef} frameRef={frameRef} dofBokehRef={dofBokehRef} dofRangeRef={dofRangeRef} />
      </Suspense>

      <Post2 focusRef={focusRef} frameRef={frameRef} dofBokehRef={dofBokehRef} dofRangeRef={dofRangeRef} />
    </>
  )
}
