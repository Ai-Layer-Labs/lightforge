package main

import (
	"fmt"
	"log"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"

	"fyne.io/systray"
	"github.com/skratchdot/open-golang/open"
)

var (
	basePath   string
	composeDir string
)

func main() {
	// Get executable directory
	ex, err := os.Executable()
	if err != nil {
		log.Fatal("Failed to get executable path:", err)
	}
	exeDir := filepath.Dir(ex)
	
	// If executable is in bin/ subdirectory, go up one level
	if filepath.Base(exeDir) == "bin" {
		basePath = filepath.Dir(exeDir)
	} else {
		basePath = exeDir
	}
	
	composeDir = basePath
	log.Printf("Installation root: %s", basePath)
	log.Printf("Docker Compose directory: %s", composeDir)

	// Set up signal handling
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)

	go func() {
		<-sigChan
		log.Println("Received shutdown signal...")
		systray.Quit()
	}()

	// Run system tray
	systray.Run(onReady, onExit)
}

func onReady() {
	systray.SetIcon(getIcon())
	systray.SetTitle("RCRT")
	systray.SetTooltip("RCRT - Podman Services")

	// Menu items
	mStatus := systray.AddMenuItem("Status: Starting...", "")
	mStatus.Disable()

	systray.AddSeparator()

	mDashboard := systray.AddMenuItem("Open Dashboard", "")
	mBrowser := systray.AddMenuItem("Launch Browser", "")

	systray.AddSeparator()

	mRestart := systray.AddMenuItem("Restart Services", "")
	mLogs := systray.AddMenuItem("View Logs", "")
	mStop := systray.AddMenuItem("Stop Services", "")

	systray.AddSeparator()

	mQuit := systray.AddMenuItem("Quit", "")

	// Start services in background
	go func() {
		log.Println("Starting RCRT with Podman...")

		if err := startPodmanServices(); err != nil {
			log.Printf("Error starting services: %v", err)
			mStatus.SetTitle("Status: Error")
			return
		}

		mStatus.SetTitle("Status: Running ✓")
		log.Println("All services started successfully")

		// Open browser after a delay
		time.Sleep(5 * time.Second)
		launchBrowser()
	}()

	// Handle menu clicks
	go func() {
		for {
			select {
			case <-mDashboard.ClickedCh:
				open.Run("http://localhost:8082")

			case <-mBrowser.ClickedCh:
				launchBrowser()

			case <-mRestart.ClickedCh:
				mStatus.SetTitle("Status: Restarting...")
				stopPodmanServices()
				time.Sleep(2 * time.Second)
				if err := startPodmanServices(); err != nil {
					mStatus.SetTitle("Status: Error")
				} else {
					mStatus.SetTitle("Status: Running ✓")
				}

			case <-mStop.ClickedCh:
				mStatus.SetTitle("Status: Stopped")
				stopPodmanServices()

			case <-mLogs.ClickedCh:
				// Show podman logs
				exec.Command("podman", "compose", "logs").Start()

			case <-mQuit.ClickedCh:
				systray.Quit()
			}
		}
	}()
}

func onExit() {
	log.Println("Shutting down RCRT...")
	stopPodmanServices()
	log.Println("Goodbye!")
}

func startPodmanServices() error {
	// Ensure .env has valid encryption key
	if err := ensureValidEnv(); err != nil {
		log.Printf("⚠️  Environment setup warning: %v", err)
	}
	
	// Find Podman executable
	podmanExe := findPodman()
	if podmanExe == "" {
		return fmt.Errorf("Podman is not installed or not found")
	}
	
	log.Printf("Using Podman: %s", podmanExe)

	// Initialize Podman machine if needed (first run)
	log.Println("Checking Podman machine...")
	listCmd := exec.Command(podmanExe, "machine", "list", "--format", "{{.Name}}")
	output, _ := listCmd.Output()
	
	if len(output) == 0 {
		// No machine exists, create one
		log.Println("Initializing Podman machine (first run, ~1-2 minutes)...")
		log.Println("This downloads a Linux VM and configures it...")
		
		// Use --rootful for compatibility with all container types
		initCmd := exec.Command(podmanExe, "machine", "init", "--now", "--rootful")
		initCmd.Stdout = os.Stdout
		initCmd.Stderr = os.Stderr
		
		if err := initCmd.Run(); err != nil {
			log.Printf("⚠️  Machine init error: %v", err)
			log.Println("   This may be due to WSL not being installed")
			log.Println("   Please ensure WSL is enabled in Windows Features")
			log.Println("   Run: wsl --install")
			return fmt.Errorf("failed to initialize Podman machine: %w", err)
		}
		log.Println("✓ Podman machine initialized and started")
	} else {
		// Machine exists, try to start it
		log.Println("Starting Podman machine...")
		startCmd := exec.Command(podmanExe, "machine", "start")
		output, err := startCmd.CombinedOutput()
		outputStr := string(output)
		
		if err != nil {
			// Check if error is because machine is already running (OK)
			if contains(outputStr, "already running") || contains(outputStr, "already started") {
				log.Println("✓ Podman machine already running")
			} else if contains(outputStr, "ssh error") || contains(outputStr, "not transition into running") || contains(outputStr, "pipe instances are busy") {
				// Machine is corrupted, recreate it
				log.Println("⚠️  Machine appears corrupted, recreating...")
				log.Println("   Stopping corrupted machine...")
				exec.Command(podmanExe, "machine", "stop", "-f").Run()
				time.Sleep(3 * time.Second)
				
				log.Println("   Removing corrupted machine...")
				removeCmd := exec.Command(podmanExe, "machine", "rm", "-f", "podman-machine-default")
				removeCmd.Run()
				time.Sleep(2 * time.Second)
				
				log.Println("   Recreating machine (~2 minutes, please wait)...")
				initCmd := exec.Command(podmanExe, "machine", "init", "--now", "--rootful")
				initCmd.Stdout = os.Stdout
				initCmd.Stderr = os.Stderr
				
				if err := initCmd.Run(); err != nil {
					return fmt.Errorf("failed to recreate machine: %w", err)
				}
				log.Println("✓ Machine recreated and started successfully")
			} else {
				log.Printf("⚠️  Machine start error: %v", err)
				log.Printf("   Output: %s", outputStr)
				log.Println("   Continuing anyway...")
			}
		} else {
			log.Println("✓ Podman machine started")
		}
		
		// Wait for machine to be fully ready
		log.Println("Waiting for machine to be ready...")
		time.Sleep(10 * time.Second)
	}

	// Additional wait to ensure Podman socket is ready
	time.Sleep(5 * time.Second)

	// Import Docker images if needed (first run)
	imagesDir := filepath.Join(basePath, "images")
	if _, err := os.Stat(imagesDir); err == nil {
		log.Println("Importing Docker images (first run, ~2-3 minutes)...")
		
		// Import all tar files
		files, _ := filepath.Glob(filepath.Join(imagesDir, "*.tar"))
		for _, file := range files {
			log.Printf("Importing %s...", filepath.Base(file))
			importCmd := exec.Command(podmanExe, "load", "-i", file)
			if err := importCmd.Run(); err != nil {
				log.Printf("⚠️  Import warning for %s: %v", filepath.Base(file), err)
			}
		}
		
		// Remove images directory after successful import
		os.RemoveAll(imagesDir)
		log.Println("✓ All images imported")
	}

	// Run docker-compose up
	log.Println("Starting Docker Compose services...")
	composeCmd := exec.Command(podmanExe, "compose", "up", "-d")
	composeCmd.Dir = composeDir
	composeCmd.Stdout = os.Stdout
	composeCmd.Stderr = os.Stderr

	if err := composeCmd.Run(); err != nil {
		return fmt.Errorf("failed to start services: %w", err)
	}

	log.Println("✓ Services started")
	
	// Wait for services to be ready
	log.Println("Waiting for services to be ready...")
	time.Sleep(30 * time.Second)
	
	// Run bootstrap on first launch (like setup.sh does)
	if err := runBootstrap(); err != nil {
		log.Printf("⚠️  Bootstrap warning: %v", err)
		log.Println("   You can manually bootstrap later using docker exec")
	} else {
		log.Println("✓ Bootstrap complete - system ready!")
		
		// Restart tools-runner to load model catalog (per setup.sh)
		log.Println("Restarting tools-runner to load model catalog...")
		exec.Command(podmanExe, "compose", "restart", "tools-runner").Run()
		time.Sleep(10 * time.Second)
	}
	
	return nil
}

func runBootstrap() error {
	podmanExe := findPodman()
	if podmanExe == "" {
		return fmt.Errorf("Podman not found")
	}
	
	// Check if already bootstrapped (check for marker file)
	markerFile := filepath.Join(basePath, ".bootstrapped")
	if _, err := os.Stat(markerFile); err == nil {
		log.Println("System already bootstrapped, skipping...")
		return nil
	}
	
	log.Println("🌱 Bootstrapping RCRT system (first run)...")
	log.Println("   This creates agents, tools, and system configuration...")
	
	// Run bootstrap from host (bootstrap-breadcrumbs bundled in installer)
	bootstrapDir := filepath.Join(basePath, "bootstrap-breadcrumbs")
	bootstrapScript := filepath.Join(bootstrapDir, "bootstrap.js")
	
	// Check if bootstrap directory exists
	if _, err := os.Stat(bootstrapScript); err != nil {
		return fmt.Errorf("bootstrap script not found: %s", bootstrapScript)
	}
	
	// Find Node.js (bundled or system)
	nodeExe := "node" // System Node.js
	
	bootstrapCmd := exec.Command(nodeExe, bootstrapScript)
	bootstrapCmd.Dir = bootstrapDir
	
	// Set environment variables for bootstrap
	// Use host's localhost to connect to Podman-exposed ports
	bootstrapCmd.Env = append(os.Environ(),
		"RCRT_BASE_URL=http://localhost:8081", // External port mapping
		"OWNER_ID=00000000-0000-0000-0000-000000000001",
		"AGENT_ID=00000000-0000-0000-0000-0000000000aa",
	)
	
	bootstrapCmd.Stdout = os.Stdout
	bootstrapCmd.Stderr = os.Stderr
	
	if err := bootstrapCmd.Run(); err != nil {
		return fmt.Errorf("bootstrap script failed: %w", err)
	}
	
	log.Println("✓ Bootstrap script completed")
	log.Println("   Waiting for bootstrap tools to execute...")
	time.Sleep(20 * time.Second)
	
	// Create marker file
	os.WriteFile(markerFile, []byte("bootstrapped"), 0644)
	log.Println("✓ Bootstrap marker created")
	
	return nil
}


// findPodman finds Podman executable by checking PATH and common locations
func findPodman() string {
	// Try PATH first
	if path, err := exec.LookPath("podman"); err == nil {
		return path
	}
	
	// Check common installation locations
	podmanPaths := []string{
		"C:\\Program Files\\RedHat\\Podman\\podman.exe",
		"C:\\Program Files (x86)\\RedHat\\Podman\\podman.exe",
		filepath.Join(os.Getenv("LOCALAPPDATA"), "Podman", "podman.exe"),
	}
	
	for _, path := range podmanPaths {
		if _, err := os.Stat(path); err == nil {
			log.Printf("Found Podman at: %s", path)
			// Add to PATH for this session
			currentPath := os.Getenv("PATH")
			os.Setenv("PATH", filepath.Dir(path)+";"+currentPath)
			return path
		}
	}
	
	log.Println("⚠️  Podman not found in PATH or standard locations")
	log.Println("   Installer should have installed Podman CLI")
	log.Println("   You may need to restart Windows to update PATH")
	
	return ""
}

func contains(s, substr string) bool {
	return len(s) > 0 && len(substr) > 0 && (s == substr || len(s) >= len(substr) && (s[:len(substr)] == substr || s[len(s)-len(substr):] == substr || findInString(s, substr)))
}

func findInString(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}

func stopPodmanServices() {
	log.Println("Stopping services...")
	podmanExe := findPodman()
	if podmanExe == "" {
		podmanExe = "podman" // Fallback
	}
	cmd := exec.Command(podmanExe, "compose", "down")
	cmd.Dir = composeDir
	cmd.Run()
}

func launchBrowser() {
	extensionPath := filepath.Join(basePath, "extension")
	
	// Check for Helium in multiple locations
	browserPaths := []string{
		filepath.Join(basePath, "browser", "helium_0.5.8.1_x64-windows", "chrome.exe"),
		filepath.Join(basePath, "browser", "chrome.exe"),
		filepath.Join(basePath, "browser", "helium.exe"),
	}
	
	for _, browserPath := range browserPaths {
		if _, err := os.Stat(browserPath); err == nil {
			log.Printf("Launching Helium from: %s", browserPath)
			cmd := exec.Command(browserPath,
				fmt.Sprintf("--load-extension=%s", extensionPath),
				"http://localhost:8082",
			)
			if err := cmd.Start(); err != nil {
				log.Printf("Failed to launch Helium: %v", err)
			} else {
				log.Println("✓ Helium launched with extension")
				return
			}
		}
	}
	
	// Fallback to default browser
	log.Println("Helium not found, opening in default browser")
	open.Run("http://localhost:8082")
}

// getIcon moved to icon.go

