# =====================================
# 🚀 MC PANEL — Colab Edition
# Startup order:
#   1. Mount Google Drive (if available)
#   2. Install Java 21 (if missing)
#   3. Write eula.txt -> eula=true
#   4. Start Flask + ngrok -> print panel URL
# =====================================

import os, subprocess, threading, psutil, time, requests, shutil
from flask import Flask, request, session, redirect, jsonify, render_template
from pyngrok import ngrok
from ansi2html import Ansi2HTMLConverter

# ── Config ─────────────────────────────────────────
MC_VERSION        = "1.21.1"
SERVER_TYPE       = "paper"
ADMIN_USER        = "admin"
ADMIN_PASS        = "1234"
NGROK_AUTH_TOKEN  = os.getenv("NGROK_AUTH_TOKEN", "")

# ── Step 1 — Google Drive ──────────────────────────
print("=" * 60)
print("📂 Step 1 — Mounting Google Drive...")
DRIVE_MOUNTED = False
try:
    from google.colab import drive
    drive.mount('/content/drive', force_remount=False)
    DRIVE_MOUNTED = True
    BASE_DIR = "/content/drive/MyDrive/MinecraftServer"
    print("✅  Drive mounted → saving to Google Drive")
except Exception as e:
    BASE_DIR = "/content/Minecraft-server"
    print(f"⚠️  Drive unavailable ({e.__class__.__name__}) — using local storage")

os.makedirs(BASE_DIR, exist_ok=True)
os.chdir(BASE_DIR)
print(f"📁  Working dir: {BASE_DIR}")

# ── Step 2 — Java 21 ───────────────────────────────
JAVA_BIN = "/usr/lib/jvm/java-21-openjdk-amd64/bin/java"
print("\n☕ Step 2 — Checking Java 21...")
if not os.path.exists(JAVA_BIN):
    print("   Installing OpenJDK 21 (may take ~1 min)...")
    os.system("apt-get update -qq")
    os.system("apt-get install -y openjdk-21-jdk > /dev/null 2>&1")
    if not os.path.exists(JAVA_BIN):
        result = subprocess.run(["find","/usr/lib/jvm","-name","java","-path","*21*"],
                                capture_output=True, text=True)
        found = result.stdout.strip().splitlines()
        JAVA_BIN = found[0] if found else "/usr/bin/java"
    print(f"✅  Java 21 ready: {JAVA_BIN}")
else:
    ver = subprocess.run([JAVA_BIN,"-version"],capture_output=True,text=True).stderr.split("\n")[0]
    print(f"✅  {ver}")

# ── Step 3 — EULA ──────────────────────────────────
print("\n📜 Step 3 — Writing EULA (eula=true)...")
eula_path = os.path.join(BASE_DIR, "eula.txt")
with open(eula_path, "w") as f:
    f.write("# Minecraft EULA — https://aka.ms/MinecraftEULA\n")
    f.write("# Auto-accepted by MC Colab Panel\n")
    f.write("eula=true\n")
print("✅  eula=true saved")

# ── Server state ────────────────────────────────────
AVAILABLE_VERSIONS = ["1.21.4","1.21.3","1.21.1","1.20.6","1.20.4","1.20.1","1.19.4"]
AVAILABLE_TYPES    = ["paper","purpur","vanilla"]
server = None; running = False; starting = False
current_version = MC_VERSION; current_type = SERVER_TYPE
logs = []; players = set(); ram_hist = []; tps_hist = []
mc_ip = "Server Offline"; mc_tunnel = None

def download_server(version, stype):
    jar = os.path.join(BASE_DIR, f"server-{stype}-{version}.jar")
    if os.path.exists(jar): return jar
    print(f"📦 Downloading {stype} {version}...")
    if stype == "paper":
        api = f"https://api.papermc.io/v2/projects/paper/versions/{version}"
        builds = requests.get(api,timeout=15).json().get("builds",[])
        if not builds: raise Exception(f"No Paper builds for {version}")
        latest = builds[-1]
        url = f"https://api.papermc.io/v2/projects/paper/versions/{version}/builds/{latest}/downloads/paper-{version}-{latest}.jar"
    elif stype == "purpur":
        url = f"https://api.purpurmc.org/v2/purpur/{version}/latest/download"
    elif stype == "vanilla":
        manifest = requests.get("https://piston-meta.mojang.com/mc/game/version_manifest_v2.json",timeout=15).json()
        ver_info = next((v for v in manifest["versions"] if v["id"]==version), None)
        if not ver_info: raise Exception(f"Vanilla {version} not found")
        url = requests.get(ver_info["url"],timeout=15).json()["downloads"]["server"]["url"]
    else: raise Exception("Unsupported type")
    with open(jar,"wb") as fh: fh.write(requests.get(url,timeout=120).content)
    return jar

def get_max_ram():
    return f"{max(1,int(psutil.virtual_memory().total/(1024**3)-1))}G"

def parse_log(line):
    if "joined the game" in line:
        name = line.split()[0] if line.split() else ""
        if name: players.add(name)
    if "left the game" in line:
        name = line.split()[0] if line.split() else ""
        if name: players.discard(name)

def colorize(line):
    if "ERROR" in line: return f"\x1b[31m{line}\x1b[0m"
    if "WARN"  in line: return f"\x1b[33m{line}\x1b[0m"
    if "joined" in line: return f"\x1b[32m{line}\x1b[0m"
    return line

def start_server(version, stype):
    global server, running, current_version, current_type
    if running: return
    jar = download_server(version, stype)
    with open(eula_path,"w") as f: f.write("eula=true\n")
    ram = get_max_ram()
    server = subprocess.Popen(
        [JAVA_BIN, f"-Xmx{ram}", f"-Xms{ram}",
         "-XX:+UseG1GC", "-XX:+ParallelRefProcEnabled",
         "-jar", jar, "nogui"],
        stdin=subprocess.PIPE, stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT, text=True, cwd=BASE_DIR
    )
    running = True; current_version = version; current_type = stype
    def read():
        for line in server.stdout:
            line = line.strip(); parse_log(line)
            logs.append(colorize(line))
            if len(logs) > 500: logs.pop(0)
    threading.Thread(target=read, daemon=True).start()

def stop_server():
    global running
    if server:
        try: server.stdin.write("stop\n"); server.stdin.flush()
        except: pass
    running = False

def send_cmd(cmd):
    if server: server.stdin.write(cmd+"\n"); server.stdin.flush()

def update_stats():
    ram = round(psutil.virtual_memory().used/1e9, 2)
    tps = round(18+(2*(time.time()%1)), 2)
    ram_hist.append(ram); tps_hist.append(tps)
    if len(ram_hist)>20: ram_hist.pop(0); tps_hist.pop(0)
    return ram_hist, tps_hist

# ── Flask ───────────────────────────────────────────
app = Flask(__name__)
app.secret_key = "mc_colab_secret_2025"

# ── Step 4 — ngrok ─────────────────────────────────
print("\n🌐 Step 4 — Setting up ngrok tunnel...")
if NGROK_AUTH_TOKEN:
    ngrok.set_auth_token(NGROK_AUTH_TOKEN)
    PANEL_URL = ngrok.connect(5000).public_url
else:
    print("❌ NGROK AUTH TOKEN NOT SET — TCP WILL FAIL")
    PANEL_URL = "http://localhost:5000 (NO PUBLIC ACCESS)"
conv = Ansi2HTMLConverter(inline=True)

@app.route("/", methods=["GET","POST"])
def login():
    if request.method == "POST":
        if request.form.get("u")==ADMIN_USER and request.form.get("p")==ADMIN_PASS:
            session["user"] = True; return redirect("/panel")
        return render_template("login.html", error="Invalid credentials")
    return render_template("login.html")

@app.route("/panel")
def panel():
    if "user" not in session: return redirect("/")
    return render_template("dashboard.html")

@app.route("/logout")
def logout(): session.clear(); return redirect("/")

@app.route("/start")
def start():
    global starting, mc_ip, mc_tunnel

    version = request.args.get("version", current_version)
    stype   = request.args.get("type", current_type)

    if running or starting:
        return "busy"

    starting = True
    mc_ip = "Starting server..."

    def run():
        global starting, mc_ip, mc_tunnel

        try:
            print("🚀 Starting Minecraft server...")
            start_server(version, stype)

            # ⏳ Wait for server to fully start
            print("⏳ Waiting for server to boot...")
            time.sleep(15)

            # 🧹 Clean old tunnels (VERY IMPORTANT)
            try:
                ngrok.kill()
                print("🧹 Cleaned old ngrok tunnels")
            except:
                pass

            # 🌐 Create TCP tunnel
            print("🌐 Creating ngrok TCP tunnel...")
            mc_tunnel = ngrok.connect(25565, "tcp")

            if not mc_tunnel or not mc_tunnel.public_url:
                raise Exception("No tunnel URL returned")

            # ✅ Format IP
            mc_ip = mc_tunnel.public_url.replace("tcp://", "")

            print("✅ MC SERVER IP:", mc_ip)

        except Exception as e:
            mc_ip = f"Tunnel Error: {str(e)}"
            print("❌ ERROR:", e)

        starting = False

    threading.Thread(target=run, daemon=True).start()
    return "ok"

@app.route("/stop")
def stop():
    global starting, mc_ip, mc_tunnel, running

    print("🛑 Stopping Minecraft server...")

    try:
        # Stop Minecraft server
        if server and running:
            try:
                server.stdin.write("stop\n")
                server.stdin.flush()
                print("📴 Stop command sent to server")
            except Exception as e:
                print("⚠️ Could not send stop command:", e)

            time.sleep(5)

            if server.poll() is None:
                print("⚠️ Force killing server...")
                server.kill()

        running = False

    except Exception as e:
        print("❌ Server stop error:", e)

    # 🔌 Close ngrok tunnel completely
    try:
        if mc_tunnel:
            print("🌐 Closing ngrok tunnel:", mc_tunnel.public_url)
            ngrok.disconnect(mc_tunnel.public_url)

        ngrok.kill()  # 💥 ensures ALL tunnels are closed
        print("✅ ngrok fully stopped")

    except Exception as e:
        print("⚠️ ngrok disconnect error:", e)

    mc_tunnel = None
    mc_ip = "Server Offline"
    starting = False

    return "ok"

@app.route("/cmd", methods=["POST"])
def cmd(): send_cmd(request.form["cmd"]); return "ok"

@app.route("/server_info")
def server_info():
    return jsonify({"version":current_version,"type":current_type,
        "available_versions":AVAILABLE_VERSIONS,"available_types":AVAILABLE_TYPES,
        "drive_mounted":DRIVE_MOUNTED,"base_dir":BASE_DIR,"java_bin":JAVA_BIN,"eula_path":eula_path})

@app.route("/set_server", methods=["POST"])
def set_server():
    global current_version, current_type
    if running: return jsonify({"error":"Stop server first"}), 400
    d = request.json
    current_version = d.get("version",current_version)
    current_type    = d.get("type",   current_type)
    return jsonify({"ok":True,"version":current_version,"type":current_type})

@app.route("/logs")
def get_logs(): return conv.convert("<br>".join(logs), full=False)

@app.route("/stats")
def stats():
    r,t = update_stats()
    return jsonify({"running":running,"starting":starting,"ram":r,"tps":t,
                    "ip":mc_ip,"version":current_version,"type":current_type})

@app.route("/players")
def get_players(): return jsonify(list(players))

@app.route("/files_json")
def files():
    try:
        entries = []
        for f in sorted(os.listdir(".")):
            path = os.path.join(".",f); stat = os.stat(path)
            entries.append({"name":f,"is_dir":os.path.isdir(path),"size":stat.st_size,"modified":round(stat.st_mtime)})
        return jsonify(entries)
    except Exception as e: return jsonify({"error":str(e)}), 500

@app.route("/file")
def get_file():
    name = request.args.get("name")
    if not name: return "No file",400
    try: return open(name,errors="replace").read()
    except Exception as e: return str(e),500

@app.route("/save_file", methods=["POST"])
def save():
    d = request.json
    try: open(d["name"],"w").write(d["content"]); return "ok"
    except Exception as e: return str(e),500

@app.route("/delete_file", methods=["POST"])
def delete_file():
    name = request.json.get("name")
    if not name: return "No name",400
    try:
        path = os.path.join(".",name)
        shutil.rmtree(path) if os.path.isdir(path) else os.remove(path)
        return "ok"
    except Exception as e: return str(e),500

@app.route("/rename_file", methods=["POST"])
def rename_file():
    d = request.json; old,new = d.get("old"),d.get("new")
    if not old or not new: return "Missing",400
    try: os.rename(os.path.join(".",old), os.path.join(".",new)); return "ok"
    except Exception as e: return str(e),500

@app.route("/upload", methods=["POST"])
def upload(): f = request.files["file"]; f.save(f.filename); return "ok"

@app.route("/search_plugin")
def search_plugin():
    q = request.args.get("q","")
    res = requests.get(f'https://api.modrinth.com/v2/search?query={q}&facets=[["project_type:plugin"]]&limit=12',timeout=10).json()
    return jsonify([{"name":x.get("title",""),"id":x.get("project_id",""),"description":x.get("description",""),
        "downloads":x.get("downloads",0),"follows":x.get("follows",0),"icon_url":x.get("icon_url",""),
        "author":x.get("author",""),"categories":x.get("categories",[]),
        "game_versions":(x.get("versions") or [])[-3:],
        "source_url":f"https://modrinth.com/plugin/{x.get('slug',x.get('project_id',''))}",
    } for x in res.get("hits",[])])

@app.route("/install_plugin")
def install_plugin():
    pid = request.args.get("id")
    v = requests.get(f"https://api.modrinth.com/v2/project/{pid}/version",timeout=10).json()[0]
    url = v["files"][0]["url"]; name = v["files"][0]["filename"]
    os.makedirs("plugins",exist_ok=True)
    with open(f"plugins/{name}","wb") as fh: fh.write(requests.get(url,timeout=60).content)
    return "ok"

# ── Launch ──────────────────────────────────────────
print("\n" + "=" * 60)
print("✅  All steps complete! MC Panel is ready.")
print(f"🌐  Panel URL  →  {PANEL_URL}")
print(f"📁  Server dir →  {BASE_DIR}")
print(f"☕  Java       →  {JAVA_BIN}")
print(f"💾  Drive      →  {'Mounted ✅' if DRIVE_MOUNTED else 'Local only ⚠️'}")
print(f"📜  EULA       →  {eula_path}")
print("=" * 60 + "\n")

app.run(host="0.0.0.0", port=5000)
