// Variáveis globais
            let scene, camera, renderer, controls;
            let currentCategory = "fractals";
            let currentObject = "mandelbrot";
            let isAnimating = true;
            let clock = new THREE.Clock();
            let frameCount = 0;
            let lastTime = 0;
            let fps = 0;

            // Objetos atuais
            let currentFractal = null;
            let currentSurface = null;
            let currentVectorField = null;
            let currentChaosSystem = null;
            let currentPolyhedron = null;
            let currentCurve = null;

            // Uniforms do shader de fractal
            let fractalUniforms = null;

            // Inicialização
            function init() {
                // Criar cena
                scene = new THREE.Scene();
                scene.background = new THREE.Color(0x0a0c1a);

                // Criar câmera
                const canvasContainer = document.getElementById("math-canvas");
                camera = new THREE.PerspectiveCamera(
                    60,
                    canvasContainer.offsetWidth / canvasContainer.offsetHeight,
                    0.1,
                    1000,
                );
                camera.position.set(0, 0, 5);

                // Criar renderizador
                renderer = new THREE.WebGLRenderer({ antialias: true });
                renderer.setSize(
                    canvasContainer.offsetWidth,
                    canvasContainer.offsetHeight,
                );
                renderer.setPixelRatio(window.devicePixelRatio);
                canvasContainer.appendChild(renderer.domElement);

                // Adicionar controles de órbita
                controls = new THREE.OrbitControls(camera, renderer.domElement);
                controls.enableDamping = true;
                controls.dampingFactor = 0.05;

                // Adicionar iluminação
                const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
                scene.add(ambientLight);

                const directionalLight = new THREE.DirectionalLight(
                    0xffffff,
                    0.8,
                );
                directionalLight.position.set(5, 10, 7);
                scene.add(directionalLight);

                // Inicializar objetos iniciais
                initFractal();
                updateObjectDescription();

                // Esconder mensagem de carregamento
                document.getElementById("loading-message").style.display =
                    "none";

                // Iniciar animação
                animate();

                // Configurar listeners de eventos
                setupEventListeners();

                // Configurar redimensionamento da janela
                window.addEventListener("resize", onWindowResize);

                // Atualizar estatísticas
                setInterval(updateStats, 1000);
            }

            // Inicializar fractal
            function initFractal() {
                // Criar plano para o fractal
                const geometry = new THREE.PlaneGeometry(8, 8);

                // Shader para fractal
                fractalUniforms = {
                    u_resolution: {
                        value: new THREE.Vector2(
                            renderer.domElement.width,
                            renderer.domElement.height,
                        ),
                    },
                    u_zoom: { value: 1.0 },
                    u_offset: { value: new THREE.Vector2(-0.5, 0.0) },
                    u_c: { value: new THREE.Vector2(-0.7, 0.27) },
                    u_maxIterations: { value: 100 },
                    u_palette: { value: 0 },
                    u_fractalType: { value: 0 },
                    u_smooth: { value: 1.0 },
                };

                const material = new THREE.ShaderMaterial({
                    uniforms: fractalUniforms,
                    vertexShader: `
                    varying vec2 vUv;
                    void main() {
                        vUv = uv;
                        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                    }
                `,
                    fragmentShader: `
                    uniform vec2 u_resolution;
                    uniform float u_zoom;
                    uniform vec2 u_offset;
                    uniform vec2 u_c;
                    uniform int u_maxIterations;
                    uniform int u_palette;
                    uniform int u_fractalType;
                    uniform float u_smooth;
                    varying vec2 vUv;

                    vec3 palette(float t, int paletteIndex) {
                        if (paletteIndex == 0) { // Rainbow
                            return 0.5 + 0.5 * cos(6.28318 * (t + vec3(0.0, 0.33, 0.67)));
                        } else if (paletteIndex == 1) { // Ice
                            return vec3(0.0, 0.2 * t, 0.5 + 0.5 * t);
                        } else if (paletteIndex == 2) { // Fire
                            return vec3(t, t * 0.5, 0.0);
                        } else if (paletteIndex == 3) { // Neon
                            return vec3(t * 0.5, t, t * 0.5);
                        } else { // Sunset
                            return vec3(t, t * 0.7, 0.0);
                        }
                    }

                    void main() {
                        vec2 c, z;

                        if (u_fractalType == 0) { // Mandelbrot
                            c = (vUv - 0.5) * 4.0 * u_zoom + u_offset;
                            z = vec2(0.0, 0.0);
                        } else { // Julia
                            c = u_c;
                            z = (vUv - 0.5) * 4.0 * u_zoom + u_offset;
                        }

                        int i;
                        float smoothColor = 0.0;

                        for(i = 0; i < u_maxIterations; i++) {
                            float x = z.x * z.x - z.y * z.y + c.x;
                            float y = 2.0 * z.x * z.y + c.y;

                            if(x * x + y * y > 4.0) {
                                if (u_smooth > 0.5) {
                                    float log_zn = log(x*x + y*y) / 2.0;
                                    float nu = log(log_zn / log(2.0)) / log(2.0);
                                    smoothColor = float(i) + 1.0 - nu;
                                }
                                break;
                            }
                            z.x = x;
                            z.y = y;
                        }

                        float t = float(i) / float(u_maxIterations);
                        if (i == u_maxIterations) {
                            gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
                        } else {
                            if (u_smooth > 0.5) {
                                t = smoothColor / float(u_maxIterations);
                            }
                            vec3 color = palette(t, u_palette);
                            gl_FragColor = vec4(color, 1.0);
                        }
                    }
                `,
                });

                currentFractal = new THREE.Mesh(geometry, material);
                scene.add(currentFractal);
            }

            // Atualizar fractal
            function updateFractal() {
                if (!currentFractal) return;

                const fractalType =
                    document.getElementById("fractal-type").value;
                fractalUniforms.u_fractalType.value =
                    fractalType === "mandelbrot" ? 0 : 1;
                fractalUniforms.u_maxIterations.value = parseInt(
                    document.getElementById("fractal-iterations").value,
                );
                fractalUniforms.u_zoom.value = parseFloat(
                    document.getElementById("fractal-zoom").value,
                );
                fractalUniforms.u_offset.value.x = parseFloat(
                    document.getElementById("fractal-offset-x").value,
                );
                fractalUniforms.u_offset.value.y = parseFloat(
                    document.getElementById("fractal-offset-y").value,
                );
                fractalUniforms.u_c.value.x = parseFloat(
                    document.getElementById("fractal-c-real").value,
                );
                fractalUniforms.u_c.value.y = parseFloat(
                    document.getElementById("fractal-c-imag").value,
                );

                const selectedColor = document.querySelector(
                    "#fractals-controls .color-option.selected",
                );
                if (selectedColor) {
                    fractalUniforms.u_palette.value = parseInt(
                        selectedColor.dataset.palette,
                    );
                }

                fractalUniforms.u_smooth.value = document.getElementById(
                    "fractal-smooth",
                ).checked
                    ? 1.0
                    : 0.0;

                // Mostrar/ocultar controles de Julia
                if (fractalType === "julia") {
                    document.getElementById(
                        "julia-c-real-control",
                    ).style.display = "flex";
                    document.getElementById(
                        "julia-c-imag-control",
                    ).style.display = "flex";
                } else {
                    document.getElementById(
                        "julia-c-real-control",
                    ).style.display = "none";
                    document.getElementById(
                        "julia-c-imag-control",
                    ).style.display = "none";
                }
            }

            // Criar superfície
            function createSurface(type) {
                // Remover superfície anterior
                if (currentSurface) {
                    scene.remove(currentSurface);
                    currentSurface = null;
                }

                const resolution = parseInt(
                    document.getElementById("surface-resolution").value,
                );
                const scale = parseFloat(
                    document.getElementById("surface-scale").value,
                );

                let geometry;

                switch (type) {
                    case "torus":
                        geometry = new THREE.TorusGeometry(
                            2 * scale,
                            0.8 * scale,
                            resolution,
                            resolution,
                        );
                        break;
                    case "klein":
                        // Superfície paramétrica para garrafa de Klein (simplificada)
                        geometry = new THREE.ParametricGeometry(
                            (u, v, target) => {
                                u = u * Math.PI * 2;
                                v = v * Math.PI * 2;

                                let x, y, z;

                                if (u < Math.PI) {
                                    x =
                                        3 * Math.cos(u) * (1 + Math.sin(u)) +
                                        2 *
                                            (1 - Math.cos(u) / 2) *
                                            Math.cos(u) *
                                            Math.cos(v);
                                    z =
                                        -8 * Math.sin(u) -
                                        2 *
                                            (1 - Math.cos(u) / 2) *
                                            Math.sin(u) *
                                            Math.cos(v);
                                } else {
                                    x =
                                        3 * Math.cos(u) * (1 + Math.sin(u)) +
                                        2 *
                                            (1 - Math.cos(u) / 2) *
                                            Math.cos(v + Math.PI);
                                    z = -8 * Math.sin(u);
                                }

                                y = -2 * (1 - Math.cos(u) / 2) * Math.sin(v);

                                target.x = x * 0.15 * scale;
                                target.y = y * 0.15 * scale;
                                target.z = z * 0.15 * scale;
                            },
                            resolution,
                            resolution,
                        );
                        break;
                    case "mobius":
                        geometry = new THREE.ParametricGeometry(
                            (u, v, target) => {
                                u = u * 2 * Math.PI;
                                v = v * 2 - 1;

                                const width = 0.5;

                                target.x =
                                    (1 + (v / 2) * Math.cos(u / 2)) *
                                    Math.cos(u) *
                                    scale;
                                target.y =
                                    (1 + (v / 2) * Math.cos(u / 2)) *
                                    Math.sin(u) *
                                    scale;
                                target.z = (v / 2) * Math.sin(u / 2) * scale;
                            },
                            resolution,
                            resolution,
                        );
                        break;
                    case "sphere":
                        geometry = new THREE.SphereGeometry(
                            2 * scale,
                            resolution,
                            resolution,
                        );
                        break;
                    case "paraboloid":
                        geometry = new THREE.ParametricGeometry(
                            (u, v, target) => {
                                u = (u - 0.5) * 4;
                                v = (v - 0.5) * 4;
                                target.x = u * scale;
                                target.y = v * scale;
                                target.z = (u * u - v * v) * 0.2 * scale;
                            },
                            resolution,
                            resolution,
                        );
                        break;
                    case "catenoid":
                        geometry = new THREE.ParametricGeometry(
                            (u, v, target) => {
                                u = u * Math.PI * 2;
                                v = (v - 0.5) * 4;
                                target.x = Math.cos(u) * Math.cosh(v) * scale;
                                target.y = Math.sin(u) * Math.cosh(v) * scale;
                                target.z = v * scale;
                            },
                            resolution,
                            resolution,
                        );
                        break;
                    default:
                        geometry = new THREE.TorusGeometry(
                            2 * scale,
                            0.8 * scale,
                            resolution,
                            resolution,
                        );
                }

                const wireframe =
                    document.getElementById("surface-wireframe").checked;
                const solid = document.getElementById("surface-solid").checked;

                let material;
                if (wireframe && solid) {
                    material = new THREE.MeshPhongMaterial({
                        color: 0x4a8cff,
                        wireframe: true,
                        transparent: true,
                        opacity: 0.8,
                        side: THREE.DoubleSide,
                    });
                } else if (wireframe) {
                    material = new THREE.MeshBasicMaterial({
                        color: 0x4a8cff,
                        wireframe: true,
                        side: THREE.DoubleSide,
                    });
                } else {
                    material = new THREE.MeshPhongMaterial({
                        color: 0x4a8cff,
                        side: THREE.DoubleSide,
                    });
                }

                currentSurface = new THREE.Mesh(geometry, material);
                scene.add(currentSurface);
            }

            // Criar campo vetorial
            function createVectorField(type) {
                // Remover campo anterior
                if (currentVectorField) {
                    scene.remove(currentVectorField);
                    currentVectorField = null;
                }

                const density = parseInt(
                    document.getElementById("vector-density").value,
                );
                const intensity = parseFloat(
                    document.getElementById("vector-intensity").value,
                );
                const arrowSize = parseFloat(
                    document.getElementById("vector-arrow-size").value,
                );
                const colorize =
                    document.getElementById("vector-colorize").checked;

                const group = new THREE.Group();
                const gridSize = 10;
                const step = gridSize / density;

                for (let x = -gridSize / 2; x <= gridSize / 2; x += step) {
                    for (let y = -gridSize / 2; y <= gridSize / 2; y += step) {
                        for (
                            let z = -gridSize / 2;
                            z <= gridSize / 2;
                            z += step
                        ) {
                            // Pular algumas setas para não sobrecarregar
                            if (Math.random() > 0.7) continue;

                            let vx, vy, vz;

                            switch (type) {
                                case "curl":
                                    vx = -y * intensity;
                                    vy = x * intensity;
                                    vz = 0;
                                    break;
                                case "gravity":
                                    const r = Math.sqrt(
                                        x * x + y * y + z * z + 0.01,
                                    );
                                    vx = (-x / (r * r * r)) * intensity * 10;
                                    vy = (-y / (r * r * r)) * intensity * 10;
                                    vz = (-z / (r * r * r)) * intensity * 10;
                                    break;
                                case "spiral":
                                    vx = -y * intensity;
                                    vy = x * intensity;
                                    vz = 0.5 * intensity;
                                    break;
                                case "uniform":
                                    vx = intensity;
                                    vy = 0;
                                    vz = 0;
                                    break;
                                case "dipole":
                                    const r2 = x * x + y * y + z * z;
                                    const r5 = r2 * r2 * Math.sqrt(r2);
                                    vx = ((3 * x * z) / r5) * intensity * 100;
                                    vy = ((3 * y * z) / r5) * intensity * 100;
                                    vz =
                                        ((3 * z * z - r2) / r5) *
                                        intensity *
                                        100;
                                    break;
                                default:
                                    vx = -y * intensity;
                                    vy = x * intensity;
                                    vz = 0;
                            }

                            // Calcular magnitude para coloração
                            const magnitude = Math.sqrt(
                                vx * vx + vy * vy + vz * vz,
                            );
                            const normalizedMagnitude = Math.min(
                                magnitude / (intensity * 2),
                                1,
                            );

                            // Escolher cor
                            let color;
                            if (colorize) {
                                // Gradiente de azul (baixa magnitude) para vermelho (alta magnitude)
                                color = new THREE.Color();
                                color.setHSL(
                                    0.7 - normalizedMagnitude * 0.7,
                                    1,
                                    0.5,
                                );
                            } else {
                                color = 0x4a8cff;
                            }

                            // Criar seta
                            const arrowHelper = new THREE.ArrowHelper(
                                new THREE.Vector3(vx, vy, vz).normalize(),
                                new THREE.Vector3(x, y, z),
                                magnitude * arrowSize * 0.5,
                                color,
                                arrowSize * 0.3,
                                arrowSize * 0.15,
                            );

                            group.add(arrowHelper);
                        }
                    }
                }

                currentVectorField = group;
                scene.add(currentVectorField);
            }

            // Criar sistema caótico
            function createChaosSystem(type) {
                // Remover sistema anterior
                if (currentChaosSystem) {
                    scene.remove(currentChaosSystem);
                    currentChaosSystem = null;
                }

                const sigma = parseFloat(
                    document.getElementById("chaos-sigma").value,
                );
                const rho = parseFloat(
                    document.getElementById("chaos-rho").value,
                );
                const beta = parseFloat(
                    document.getElementById("chaos-beta").value,
                );
                const speed = parseFloat(
                    document.getElementById("chaos-speed").value,
                );
                const points = parseInt(
                    document.getElementById("chaos-points").value,
                );

                let x = 0.1,
                    y = 0,
                    z = 0;
                const dt = 0.01;
                const trailPoints = [];

                // Gerar pontos da trajetória
                for (let i = 0; i < points; i++) {
                    let dx, dy, dz;

                    if (type === "lorenz") {
                        dx = sigma * (y - x) * dt * speed;
                        dy = (x * (rho - z) - y) * dt * speed;
                        dz = (x * y - beta * z) * dt * speed;
                    } else if (type === "rossler") {
                        dx = (-y - z) * dt * speed;
                        dy = (x + 0.2 * y) * dt * speed;
                        dz = (0.2 + z * (x - 5.7)) * dt * speed;
                    } else {
                        // Lorenz por padrão
                        dx = sigma * (y - x) * dt * speed;
                        dy = (x * (rho - z) - y) * dt * speed;
                        dz = (x * y - beta * z) * dt * speed;
                    }

                    x += dx;
                    y += dy;
                    z += dz;

                    // Adicionar ponto à trajetória (escala ajustada)
                    let scale = 0.1;
                    if (type === "rossler") scale = 0.5;
                    trailPoints.push(
                        new THREE.Vector3(x * scale, y * scale, z * scale),
                    );
                }

                // Criar geometria da linha
                const geometry = new THREE.BufferGeometry().setFromPoints(
                    trailPoints,
                );
                const material = new THREE.LineBasicMaterial({
                    color: 0x4a8cff,
                    linewidth: 2,
                });

                const line = new THREE.Line(geometry, material);
                currentChaosSystem = line;
                scene.add(currentChaosSystem);
            }

            // Criar poliedro
            function createPolyhedron(type) {
                // Remover poliedro anterior
                if (currentPolyhedron) {
                    scene.remove(currentPolyhedron);
                    currentPolyhedron = null;
                }

                const size = parseFloat(
                    document.getElementById("polyhedra-size").value,
                );
                const wireframe = document.getElementById(
                    "polyhedra-wireframe",
                ).checked;
                const solid =
                    document.getElementById("polyhedra-faces").checked;

                let geometry;

                switch (type) {
                    case "tetrahedron":
                        geometry = new THREE.TetrahedronGeometry(size);
                        break;
                    case "cube":
                        geometry = new THREE.BoxGeometry(size, size, size);
                        break;
                    case "octahedron":
                        geometry = new THREE.OctahedronGeometry(size);
                        break;
                    case "dodecahedron":
                        geometry = new THREE.DodecahedronGeometry(size);
                        break;
                    case "icosahedron":
                        geometry = new THREE.IcosahedronGeometry(size);
                        break;
                    case "truncated_icosahedron":
                        geometry = new THREE.DodecahedronGeometry(size * 0.9);
                        break;
                    default:
                        geometry = new THREE.IcosahedronGeometry(size);
                }

                let material;
                if (wireframe && solid) {
                    material = new THREE.MeshPhongMaterial({
                        color: 0x4a8cff,
                        wireframe: true,
                        transparent: true,
                        opacity: 0.8,
                    });
                } else if (wireframe) {
                    material = new THREE.MeshBasicMaterial({
                        color: 0x4a8cff,
                        wireframe: true,
                    });
                } else {
                    material = new THREE.MeshPhongMaterial({
                        color: 0x4a8cff,
                    });
                }

                currentPolyhedron = new THREE.Mesh(geometry, material);
                scene.add(currentPolyhedron);
            }

            // Criar curva
            function createCurve(type) {
                // Remover curva anterior
                if (currentCurve) {
                    scene.remove(currentCurve);
                    currentCurve = null;
                }

                const resolution = parseInt(
                    document.getElementById("curve-resolution").value,
                );
                const paramA = parseFloat(
                    document.getElementById("curve-param-a").value,
                );
                const paramB = parseFloat(
                    document.getElementById("curve-param-b").value,
                );
                const thickness = parseFloat(
                    document.getElementById("curve-thickness").value,
                );
                const asTube = document.getElementById("curve-tube").checked;

                const points = [];

                // Gerar pontos da curva
                for (let i = 0; i <= resolution; i++) {
                    const t = (i / resolution) * Math.PI * 2 * paramB;
                    let px,
                        py,
                        pz = 0;

                    switch (type) {
                        case "spiral":
                            px = paramA * t * Math.cos(t);
                            py = paramA * t * Math.sin(t);
                            pz = t * 0.5;
                            break;
                        case "helix":
                            px = paramA * Math.cos(t);
                            py = paramA * Math.sin(t);
                            pz = t;
                            break;
                        case "lissajous":
                            px = Math.sin(paramA * t);
                            py = Math.sin(paramB * t + Math.PI / 2);
                            pz = Math.sin(3 * t) * 0.5;
                            break;
                        case "rose":
                            const k = 3 / paramB;
                            const r = Math.cos(k * t) * paramA;
                            px = r * Math.cos(t);
                            py = r * Math.sin(t);
                            break;
                        case "cardioid":
                            const r2 = paramA * (1 + Math.cos(t));
                            px = r2 * Math.cos(t);
                            py = r2 * Math.sin(t);
                            break;
                        case "lemniscate":
                            const r3 = paramA * Math.sqrt(Math.cos(2 * t));
                            px = r3 * Math.cos(t);
                            py = r3 * Math.sin(t);
                            break;
                        default:
                            px = paramA * t * Math.cos(t);
                            py = paramA * t * Math.sin(t);
                            pz = t * 0.5;
                    }

                    points.push(new THREE.Vector3(px, py, pz));
                }

                if (asTube) {
                    // Criar curva como tubo 3D
                    const curve = new THREE.CatmullRomCurve3(points);
                    const tubeGeometry = new THREE.TubeGeometry(
                        curve,
                        resolution,
                        thickness / 20,
                        8,
                        false,
                    );
                    const material = new THREE.MeshPhongMaterial({
                        color: 0x4a8cff,
                        side: THREE.DoubleSide,
                    });
                    currentCurve = new THREE.Mesh(tubeGeometry, material);
                } else {
                    // Criar curva como linha
                    const geometry = new THREE.BufferGeometry().setFromPoints(
                        points,
                    );
                    const material = new THREE.LineBasicMaterial({
                        color: 0x4a8cff,
                        linewidth: thickness,
                    });
                    currentCurve = new THREE.Line(geometry, material);
                }

                scene.add(currentCurve);
            }

            // Mostrar categoria selecionada
            function showCategory(category) {
                currentCategory = category;

                // Limpar cena
                while (scene.children.length > 0) {
                    scene.remove(scene.children[0]);
                }

                // Adicionar iluminação de volta
                const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
                scene.add(ambientLight);

                const directionalLight = new THREE.DirectionalLight(
                    0xffffff,
                    0.8,
                );
                directionalLight.position.set(5, 10, 7);
                scene.add(directionalLight);

                // Resetar controles
                controls.reset();

                // Posicionar câmera baseado na categoria
                switch (category) {
                    case "fractals":
                        camera.position.set(0, 0, 5);
                        initFractal();
                        updateFractal();
                        break;
                    case "surfaces":
                        camera.position.set(8, 8, 8);
                        createSurface("torus");
                        break;
                    case "vector":
                        camera.position.set(15, 15, 15);
                        createVectorField("curl");
                        break;
                    case "chaos":
                        camera.position.set(15, 15, 15);
                        createChaosSystem("lorenz");
                        break;
                    case "polyhedra":
                        camera.position.set(5, 5, 5);
                        createPolyhedron("icosahedron");
                        break;
                    case "curves":
                        camera.position.set(8, 8, 8);
                        createCurve("spiral");
                        break;
                }

                controls.target.set(0, 0, 0);
                controls.update();

                // Atualizar controles visíveis
                document
                    .querySelectorAll('[id$="-controls"]')
                    .forEach((control) => {
                        control.style.display = "none";
                    });
                document.getElementById(`${category}-controls`).style.display =
                    "block";

                // Atualizar botões ativos
                document.querySelectorAll(".category-btn").forEach((btn) => {
                    btn.classList.remove("active");
                    if (btn.dataset.category === category) {
                        btn.classList.add("active");
                    }
                });

                // Atualizar objeto atual baseado no select
                const select = document.getElementById(`${category}-type`);
                if (select) {
                    currentObject = select.value;
                    updateObjectDescription();
                }
            }

            // Atualizar descrição do objeto
            function updateObjectDescription() {
                const descriptions = {
                    // Fractais
                    mandelbrot:
                        "O conjunto de Mandelbrot é o fractal mais famoso, gerado pela iteração da função f(z) = z² + c no plano complexo.",
                    julia: "Os conjuntos de Julia são fractais relacionados ao conjunto de Mandelbrot. Cada ponto c no plano complexo gera um conjunto de Julia único.",
                    sierpinski:
                        "O triângulo de Sierpinski é um fractal que pode ser criado dividindo recursivamente um triângulo em triângulos menores.",
                    menger: "A esponja de Menger é uma extensão 3D do tapete de Sierpinski, um fractal com área superficial infinita e volume zero.",
                    koch: "O floco de neve de Koch é um fractal criado adicionando recursivamente triângulos aos lados de um triângulo inicial.",

                    // Superfícies
                    torus: "Um toro é uma superfície de revolução gerada pela rotação de um círculo em torno de um eixo coplanar que não o intersecta.",
                    klein: "A garrafa de Klein é uma superfície não orientável que não tem interior nem exterior. É uma superfície fechada sem bordas.",
                    mobius: "A banda de Möbius é uma superfície com apenas um lado e uma única borda.",
                    sphere: "A esfera é o conjunto de pontos equidistantes de um ponto central no espaço tridimensional.",
                    paraboloid:
                        "Um paraboloide hiperbólico é uma superfície em forma de sela, com curvatura negativa em todas as direções.",
                    catenoid:
                        "O catenoide é a superfície mínima entre dois círculos paralelos, formada pela rotação de uma catenária.",

                    // Campos vetoriais
                    curl: "Um campo de rotacional mostra vetores que giram em torno de um ponto central, representando rotação no campo vetorial.",
                    gravity:
                        "Um campo gravitacional mostra a força exercida por uma massa pontual, com vetores apontando para o centro.",
                    spiral: "Um campo em espiral combina rotação com movimento radial ou axial, criando padrões helicoidais.",
                    uniform:
                        "Um campo uniforme tem vetores de mesma magnitude e direção em todos os pontos do espaço.",
                    dipole: "Um campo de dipolo mostra o padrão de campo magnético ou elétrico ao redor de dois polos opostos.",

                    // Sistemas caóticos
                    lorenz: "O atrator de Lorenz é um sistema de equações diferenciais que exibe comportamento caótico, conhecido por sua forma de borboleta.",
                    rossler:
                        "O atrator de Rössler é um sistema caótico mais simples que o de Lorenz, com apenas uma não-linearidade.",
                    henon: "O mapa de Hénon é um sistema dinâmico discreto que exibe comportamento caótico em duas dimensões.",
                    duffing:
                        "O oscilador de Duffing é um sistema não-linear forçado que pode exibir comportamento caótico sob certas condições.",
                    chua: "O circuito de Chua é um circuito eletrônico simples que pode exibir uma variedade de comportamentos caóticos.",

                    // Poliedros
                    tetrahedron:
                        "O tetraedro é o poliedro mais simples, com 4 faces triangulares, 6 arestas e 4 vértices.",
                    cube: "O cubo (hexaedro) tem 6 faces quadradas, 12 arestas e 8 vértices.",
                    octahedron:
                        "O octaedro tem 8 faces triangulares, 12 arestas e 6 vértices.",
                    dodecahedron:
                        "O dodecaedro tem 12 faces pentagonais, 30 arestas e 20 vértices.",
                    icosahedron:
                        "O icosaedro tem 20 faces triangulares, 30 arestas e 12 vértices.",
                    truncated_icosahedron:
                        "O icosaedro truncado tem 12 faces pentagonais e 20 faces hexagonais, como uma bola de futebol.",

                    // Curvas
                    spiral: "Uma espiral é uma curva que se afasta de um ponto central enquanto gira em torno dele.",
                    helix: "Uma hélice é uma curva tridimensional que avança ao longo de um eixo enquanto gira em torno dele.",
                    lissajous:
                        "As figuras de Lissajous são curvas paramétricas que descrevem oscilações harmônicas complexas.",
                    rose: "A curva rosa (rhodonea) é uma curva sinusoidal que cria padrões semelhantes a pétalas.",
                    cardioid:
                        "A cardioide é uma curva em forma de coração, gerada por um ponto em um círculo que rola em torno de outro círculo de mesmo raio.",
                    lemniscate:
                        "A lemniscata de Bernoulli tem forma de infinito (∞) e é a curva de nível de um produto de distâncias a dois pontos fixos.",
                };

                const descriptionElement = document.getElementById(
                    `${currentCategory}-description`,
                );
                if (descriptionElement && descriptions[currentObject]) {
                    descriptionElement.textContent =
                        descriptions[currentObject];
                }
            }

            // Configurar listeners de eventos
            function setupEventListeners() {
                // Botões de categoria
                document.querySelectorAll(".category-btn").forEach((btn) => {
                    btn.addEventListener("click", () => {
                        showCategory(btn.dataset.category);
                    });
                });

                // Seletores de objeto
                document
                    .querySelectorAll(".object-select")
                    .forEach((select) => {
                        select.addEventListener("change", (e) => {
                            currentObject = e.target.value;
                            updateObjectDescription();
                            updateCurrentObject();
                        });
                    });

                // Controles de fractal
                document
                    .getElementById("fractal-iterations")
                    .addEventListener("input", (e) => {
                        document.getElementById(
                            "iterations-value",
                        ).textContent = e.target.value;
                        updateFractal();
                    });

                document
                    .getElementById("fractal-zoom")
                    .addEventListener("input", (e) => {
                        document.getElementById("zoom-value").textContent =
                            parseFloat(e.target.value).toFixed(1);
                        updateFractal();
                    });

                document
                    .getElementById("fractal-offset-x")
                    .addEventListener("input", (e) => {
                        document.getElementById("offset-x-value").textContent =
                            parseFloat(e.target.value).toFixed(2);
                        updateFractal();
                    });

                document
                    .getElementById("fractal-offset-y")
                    .addEventListener("input", (e) => {
                        document.getElementById("offset-y-value").textContent =
                            parseFloat(e.target.value).toFixed(2);
                        updateFractal();
                    });

                document
                    .getElementById("fractal-c-real")
                    .addEventListener("input", (e) => {
                        document.getElementById("c-real-value").textContent =
                            parseFloat(e.target.value).toFixed(2);
                        updateFractal();
                    });

                document
                    .getElementById("fractal-c-imag")
                    .addEventListener("input", (e) => {
                        document.getElementById("c-imag-value").textContent =
                            parseFloat(e.target.value).toFixed(2);
                        updateFractal();
                    });

                // Paleta de cores
                document
                    .querySelectorAll("#fractals-controls .color-option")
                    .forEach((option) => {
                        option.addEventListener("click", () => {
                            document
                                .querySelectorAll(
                                    "#fractals-controls .color-option",
                                )
                                .forEach((opt) => {
                                    opt.classList.remove("selected");
                                });
                            option.classList.add("selected");
                            updateFractal();
                        });
                    });

                document
                    .getElementById("fractal-smooth")
                    .addEventListener("change", updateFractal);

                // Botão de fractal aleatório
                document
                    .getElementById("random-fractal")
                    .addEventListener("click", () => {
                        document.getElementById("fractal-type").value =
                            Math.random() > 0.5 ? "mandelbrot" : "julia";
                        document.getElementById("fractal-offset-x").value = (
                            Math.random() * 3 -
                            1.5
                        ).toFixed(2);
                        document.getElementById("fractal-offset-y").value = (
                            Math.random() * 3 -
                            1.5
                        ).toFixed(2);
                        document.getElementById("fractal-c-real").value = (
                            Math.random() * 2 -
                            1
                        ).toFixed(2);
                        document.getElementById("fractal-c-imag").value = (
                            Math.random() * 2 -
                            1
                        ).toFixed(2);
                        document.getElementById("fractal-zoom").value = (
                            Math.random() * 2 +
                            0.5
                        ).toFixed(1);

                        // Atualizar valores exibidos
                        document.getElementById("offset-x-value").textContent =
                            document.getElementById("fractal-offset-x").value;
                        document.getElementById("offset-y-value").textContent =
                            document.getElementById("fractal-offset-y").value;
                        document.getElementById("c-real-value").textContent =
                            document.getElementById("fractal-c-real").value;
                        document.getElementById("c-imag-value").textContent =
                            document.getElementById("fractal-c-imag").value;
                        document.getElementById("zoom-value").textContent =
                            document.getElementById("fractal-zoom").value;

                        currentObject =
                            document.getElementById("fractal-type").value;
                        updateObjectDescription();
                        updateFractal();
                    });

                // Botão de capturar tela
                document
                    .getElementById("save-fractal")
                    .addEventListener("click", () => {
                        const link = document.createElement("a");
                        link.download = "visualizador-matematico.png";
                        link.href = renderer.domElement.toDataURL("image/png");
                        link.click();
                    });

                // Controles de superfície
                document
                    .getElementById("surface-type")
                    .addEventListener("change", () => {
                        currentObject =
                            document.getElementById("surface-type").value;
                        updateObjectDescription();
                        updateCurrentObject();
                    });

                document
                    .getElementById("surface-resolution")
                    .addEventListener("input", (e) => {
                        document.getElementById(
                            "resolution-value",
                        ).textContent = e.target.value;
                        updateCurrentObject();
                    });

                document
                    .getElementById("surface-scale")
                    .addEventListener("input", (e) => {
                        document.getElementById("scale-value").textContent =
                            parseFloat(e.target.value).toFixed(1);
                        updateCurrentObject();
                    });

                document
                    .getElementById("surface-rotation-x")
                    .addEventListener("input", (e) => {
                        document.getElementById(
                            "rotation-x-value",
                        ).textContent = e.target.value + "°";
                        if (currentSurface) {
                            currentSurface.rotation.x =
                                THREE.MathUtils.degToRad(
                                    parseFloat(e.target.value),
                                );
                        }
                    });

                document
                    .getElementById("surface-rotation-y")
                    .addEventListener("input", (e) => {
                        document.getElementById(
                            "rotation-y-value",
                        ).textContent = e.target.value + "°";
                        if (currentSurface) {
                            currentSurface.rotation.y =
                                THREE.MathUtils.degToRad(
                                    parseFloat(e.target.value),
                                );
                        }
                    });

                document
                    .getElementById("surface-wireframe")
                    .addEventListener("change", updateCurrentObject);
                document
                    .getElementById("surface-solid")
                    .addEventListener("change", updateCurrentObject);

                // Botão de superfície aleatória
                document
                    .getElementById("random-surface")
                    .addEventListener("click", () => {
                        const surfaces = [
                            "torus",
                            "klein",
                            "mobius",
                            "sphere",
                            "paraboloid",
                            "catenoid",
                        ];
                        const randomSurface =
                            surfaces[
                                Math.floor(Math.random() * surfaces.length)
                            ];
                        document.getElementById("surface-type").value =
                            randomSurface;
                        currentObject = randomSurface;
                        updateObjectDescription();
                        updateCurrentObject();
                    });

                // Botão de animar superfície
                let surfaceAnimation = null;
                document
                    .getElementById("animate-surface")
                    .addEventListener("click", () => {
                        if (surfaceAnimation) {
                            clearInterval(surfaceAnimation);
                            surfaceAnimation = null;
                            document.getElementById(
                                "animate-surface",
                            ).textContent = "Animar Rotação";
                        } else {
                            surfaceAnimation = setInterval(() => {
                                if (currentSurface) {
                                    currentSurface.rotation.y += 0.02;
                                    const deg =
                                        THREE.MathUtils.radToDeg(
                                            currentSurface.rotation.y,
                                        ) % 360;
                                    document.getElementById(
                                        "surface-rotation-y",
                                    ).value = deg;
                                    document.getElementById(
                                        "rotation-y-value",
                                    ).textContent = Math.round(deg) + "°";
                                }
                            }, 50);
                            document.getElementById(
                                "animate-surface",
                            ).textContent = "Parar Animação";
                        }
                    });

                // Controles de campo vetorial
                document
                    .getElementById("vector-type")
                    .addEventListener("change", () => {
                        currentObject =
                            document.getElementById("vector-type").value;
                        updateObjectDescription();
                        updateCurrentObject();
                    });

                document
                    .getElementById("vector-density")
                    .addEventListener("input", (e) => {
                        document.getElementById("density-value").textContent =
                            e.target.value;
                        updateCurrentObject();
                    });

                document
                    .getElementById("vector-intensity")
                    .addEventListener("input", (e) => {
                        document.getElementById("intensity-value").textContent =
                            parseFloat(e.target.value).toFixed(1);
                        updateCurrentObject();
                    });

                document
                    .getElementById("vector-arrow-size")
                    .addEventListener("input", (e) => {
                        document.getElementById(
                            "arrow-size-value",
                        ).textContent = parseFloat(e.target.value).toFixed(1);
                        updateCurrentObject();
                    });

                document
                    .getElementById("vector-colorize")
                    .addEventListener("change", updateCurrentObject);

                // Botão de redefinir campo vetorial
                document
                    .getElementById("reset-vectors")
                    .addEventListener("click", updateCurrentObject);

                // Botão de inverter campo
                document
                    .getElementById("invert-field")
                    .addEventListener("click", () => {
                        if (currentVectorField) {
                            currentVectorField.children.forEach((child) => {
                                if (child.isArrowHelper) {
                                    child.setDirection(
                                        child.direction.negate(),
                                    );
                                }
                            });
                        }
                    });

                // Controles de sistema caótico
                document
                    .getElementById("chaos-type")
                    .addEventListener("change", () => {
                        currentObject =
                            document.getElementById("chaos-type").value;
                        updateObjectDescription();
                        updateCurrentObject();
                    });

                document
                    .getElementById("chaos-sigma")
                    .addEventListener("input", (e) => {
                        document.getElementById("sigma-value").textContent =
                            parseFloat(e.target.value).toFixed(1);
                        updateCurrentObject();
                    });

                document
                    .getElementById("chaos-rho")
                    .addEventListener("input", (e) => {
                        document.getElementById("rho-value").textContent =
                            parseFloat(e.target.value).toFixed(1);
                        updateCurrentObject();
                    });

                document
                    .getElementById("chaos-beta")
                    .addEventListener("input", (e) => {
                        document.getElementById("beta-value").textContent =
                            parseFloat(e.target.value).toFixed(3);
                        updateCurrentObject();
                    });

                document
                    .getElementById("chaos-speed")
                    .addEventListener("input", (e) => {
                        document.getElementById("speed-value").textContent =
                            parseFloat(e.target.value).toFixed(1);
                        updateCurrentObject();
                    });

                document
                    .getElementById("chaos-points")
                    .addEventListener("input", (e) => {
                        document.getElementById("points-value").textContent =
                            e.target.value;
                        updateCurrentObject();
                    });

                // Botão de redefinir sistema caótico
                document
                    .getElementById("reset-chaos")
                    .addEventListener("click", updateCurrentObject);

                // Botão de parâmetros aleatórios
                document
                    .getElementById("chaos-params-random")
                    .addEventListener("click", () => {
                        document.getElementById("chaos-sigma").value = (
                            Math.random() * 10 +
                            5
                        ).toFixed(1);
                        document.getElementById("chaos-rho").value = (
                            Math.random() * 30 +
                            15
                        ).toFixed(1);
                        document.getElementById("chaos-beta").value = (
                            Math.random() * 3 +
                            1.5
                        ).toFixed(3);

                        document.getElementById("sigma-value").textContent =
                            document.getElementById("chaos-sigma").value;
                        document.getElementById("rho-value").textContent =
                            document.getElementById("chaos-rho").value;
                        document.getElementById("beta-value").textContent =
                            document.getElementById("chaos-beta").value;

                        updateCurrentObject();
                    });

                // Controles de poliedros
                document
                    .getElementById("polyhedra-type")
                    .addEventListener("change", () => {
                        currentObject =
                            document.getElementById("polyhedra-type").value;
                        updateObjectDescription();
                        updateCurrentObject();
                    });

                document
                    .getElementById("polyhedra-size")
                    .addEventListener("input", (e) => {
                        document.getElementById(
                            "polyhedra-size-value",
                        ).textContent = parseFloat(e.target.value).toFixed(1);
                        updateCurrentObject();
                    });

                document
                    .getElementById("polyhedra-rotation-x")
                    .addEventListener("input", (e) => {
                        document.getElementById(
                            "polyhedra-rotation-x-value",
                        ).textContent = e.target.value + "°";
                        if (currentPolyhedron) {
                            currentPolyhedron.rotation.x =
                                THREE.MathUtils.degToRad(
                                    parseFloat(e.target.value),
                                );
                        }
                    });

                document
                    .getElementById("polyhedra-rotation-y")
                    .addEventListener("input", (e) => {
                        document.getElementById(
                            "polyhedra-rotation-y-value",
                        ).textContent = e.target.value + "°";
                        if (currentPolyhedron) {
                            currentPolyhedron.rotation.y =
                                THREE.MathUtils.degToRad(
                                    parseFloat(e.target.value),
                                );
                        }
                    });

                document
                    .getElementById("polyhedra-wireframe")
                    .addEventListener("change", updateCurrentObject);
                document
                    .getElementById("polyhedra-faces")
                    .addEventListener("change", updateCurrentObject);

                // Botão de poliedro aleatório
                document
                    .getElementById("random-polyhedra")
                    .addEventListener("click", () => {
                        const polyhedra = [
                            "tetrahedron",
                            "cube",
                            "octahedron",
                            "dodecahedron",
                            "icosahedron",
                            "truncated_icosahedron",
                        ];
                        const randomPoly =
                            polyhedra[
                                Math.floor(Math.random() * polyhedra.length)
                            ];
                        document.getElementById("polyhedra-type").value =
                            randomPoly;
                        currentObject = randomPoly;
                        updateObjectDescription();
                        updateCurrentObject();
                    });

                // Botão de animar poliedro
                let polyhedronAnimation = null;
                document
                    .getElementById("animate-polyhedra")
                    .addEventListener("click", () => {
                        if (polyhedronAnimation) {
                            clearInterval(polyhedronAnimation);
                            polyhedronAnimation = null;
                            document.getElementById(
                                "animate-polyhedra",
                            ).textContent = "Animar Rotação";
                        } else {
                            polyhedronAnimation = setInterval(() => {
                                if (currentPolyhedron) {
                                    currentPolyhedron.rotation.y += 0.02;
                                    const deg =
                                        THREE.MathUtils.radToDeg(
                                            currentPolyhedron.rotation.y,
                                        ) % 360;
                                    document.getElementById(
                                        "polyhedra-rotation-y",
                                    ).value = deg;
                                    document.getElementById(
                                        "polyhedra-rotation-y-value",
                                    ).textContent = Math.round(deg) + "°";
                                }
                            }, 50);
                            document.getElementById(
                                "animate-polyhedra",
                            ).textContent = "Parar Animação";
                        }
                    });

                // Controles de curvas
                document
                    .getElementById("curve-type")
                    .addEventListener("change", () => {
                        currentObject =
                            document.getElementById("curve-type").value;
                        updateObjectDescription();
                        updateCurrentObject();
                    });

                document
                    .getElementById("curve-resolution")
                    .addEventListener("input", (e) => {
                        document.getElementById(
                            "curve-resolution-value",
                        ).textContent = e.target.value;
                        updateCurrentObject();
                    });

                document
                    .getElementById("curve-param-a")
                    .addEventListener("input", (e) => {
                        document.getElementById(
                            "curve-param-a-value",
                        ).textContent = parseFloat(e.target.value).toFixed(1);
                        updateCurrentObject();
                    });

                document
                    .getElementById("curve-param-b")
                    .addEventListener("input", (e) => {
                        document.getElementById(
                            "curve-param-b-value",
                        ).textContent = parseFloat(e.target.value).toFixed(1);
                        updateCurrentObject();
                    });

                document
                    .getElementById("curve-thickness")
                    .addEventListener("input", (e) => {
                        document.getElementById(
                            "curve-thickness-value",
                        ).textContent = parseFloat(e.target.value).toFixed(1);
                        updateCurrentObject();
                    });

                document
                    .getElementById("curve-tube")
                    .addEventListener("change", updateCurrentObject);

                // Botão de curva aleatória
                document
                    .getElementById("random-curve")
                    .addEventListener("click", () => {
                        const curves = [
                            "spiral",
                            "helix",
                            "lissajous",
                            "rose",
                            "cardioid",
                            "lemniscate",
                        ];
                        const randomCurve =
                            curves[Math.floor(Math.random() * curves.length)];
                        document.getElementById("curve-type").value =
                            randomCurve;
                        currentObject = randomCurve;
                        updateObjectDescription();
                        updateCurrentObject();
                    });

                // Botão de desenhar curva
                document
                    .getElementById("draw-curve")
                    .addEventListener("click", updateCurrentObject);

                // Botão de redefinir visualização
                document
                    .getElementById("reset-view")
                    .addEventListener("click", () => {
                        controls.reset();
                    });

                // Botão de pausar animação
                document
                    .getElementById("toggle-animation")
                    .addEventListener("click", () => {
                        isAnimating = !isAnimating;
                        document.getElementById(
                            "toggle-animation",
                        ).textContent = isAnimating
                            ? "Pausar Animação"
                            : "Continuar Animação";
                    });
            }

            // Atualizar objeto atual
            function updateCurrentObject() {
                switch (currentCategory) {
                    case "fractals":
                        updateFractal();
                        break;
                    case "surfaces":
                        createSurface(currentObject);
                        break;
                    case "vector":
                        createVectorField(currentObject);
                        break;
                    case "chaos":
                        createChaosSystem(currentObject);
                        break;
                    case "polyhedra":
                        createPolyhedron(currentObject);
                        break;
                    case "curves":
                        createCurve(currentObject);
                        break;
                }
            }

            // Atualizar estatísticas
            function updateStats() {
                // Contar objetos e vértices
                let objectCount = 0;
                let vertexCount = 0;

                scene.traverse((object) => {
                    if (object.isMesh || object.isPoints || object.isLine) {
                        objectCount++;
                        if (
                            object.geometry &&
                            object.geometry.attributes &&
                            object.geometry.attributes.position
                        ) {
                            vertexCount +=
                                object.geometry.attributes.position.count;
                        }
                    }
                });

                // Atualizar barra de estatísticas
                document.getElementById("stats-bar").innerHTML = `
                FPS: ${Math.round(fps)} | Objetos: ${objectCount} | Vértices: ${vertexCount.toLocaleString()}
            `;
            }

            // Redimensionar janela
            function onWindowResize() {
                const canvasContainer = document.getElementById("math-canvas");
                camera.aspect =
                    canvasContainer.offsetWidth / canvasContainer.offsetHeight;
                camera.updateProjectionMatrix();
                renderer.setSize(
                    canvasContainer.offsetWidth,
                    canvasContainer.offsetHeight,
                );

                // Atualizar resolução no shader do fractal
                if (fractalUniforms) {
                    fractalUniforms.u_resolution.value.set(
                        renderer.domElement.width,
                        renderer.domElement.height,
                    );
                }
            }

            // Loop de animação
            function animate() {
                requestAnimationFrame(animate);

                const time = clock.getElapsedTime();
                frameCount++;

                // Calcular FPS
                if (time - lastTime >= 1) {
                    fps = frameCount / (time - lastTime);
                    frameCount = 0;
                    lastTime = time;
                }

                // Atualizar controles se estiver animando
                if (isAnimating) {
                    controls.update();

                    // Animar campo vetorial
                    if (
                        currentCategory === "vector" &&
                        currentVectorField &&
                        document.getElementById("vector-animate").checked
                    ) {
                        currentVectorField.rotation.y += 0.005;
                    }

                    // Animar curva
                    if (
                        currentCategory === "curves" &&
                        currentCurve &&
                        document.getElementById("curve-animate").checked
                    ) {
                        currentCurve.rotation.y += 0.01;
                    }
                }

                // Renderizar cena
                renderer.render(scene, camera);
            }

            // Inicializar quando o DOM estiver carregado
            document.addEventListener("DOMContentLoaded", init);