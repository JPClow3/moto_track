import os
import time
from playwright.sync_api import sync_playwright

def main():
    # Setup paths
    artifact_dir = r"C:\Users\lives\.gemini\antigravity\brain\3f31d8be-f73c-4627-9e38-fa56bf5a243b"
    screenshot_dir = os.path.join(artifact_dir, "mobile_screenshots")
    os.makedirs(screenshot_dir, exist_ok=True)
    print(f"Screenshots will be saved to: {screenshot_dir}")

    # Set up playwright
    with sync_playwright() as p:
        # Emulate iPhone 12 viewport
        iphone_12 = p.devices['iPhone 12']
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(**iphone_12)
        page = context.new_page()

        # 1. Landing Page
        print("Capturing Landing Page...")
        page.goto("http://localhost:8000/")
        # Wait for page load and icons
        time.sleep(2)
        page.screenshot(path=os.path.join(screenshot_dir, "landing.png"))

        # 2. Login Page
        print("Capturing Login Page...")
        page.goto("http://localhost:8000/accounts/login/")
        time.sleep(1)
        page.screenshot(path=os.path.join(screenshot_dir, "login.png"))

        # Log in
        print("Logging in...")
        page.fill("input[name='login']", "demo@mototrack.local")
        page.fill("input[name='password']", "demo12345")
        page.click("button[type='submit']")
        time.sleep(2) # Wait for redirects and load

        # 3. Dashboard
        print("Capturing Dashboard...")
        page.screenshot(path=os.path.join(screenshot_dir, "dashboard.png"))

        # 4. Timeline (Histórico)
        print("Capturing Timeline...")
        page.goto("http://localhost:8000/reports/timeline/")
        time.sleep(2)
        page.screenshot(path=os.path.join(screenshot_dir, "timeline.png"))

        # 5. Reminders (Alertas)
        print("Capturing Reminders...")
        page.goto("http://localhost:8000/reminders/")
        time.sleep(2)
        page.screenshot(path=os.path.join(screenshot_dir, "reminders.png"))

        # 6. Garage
        print("Capturing Garage...")
        page.goto("http://localhost:8000/garage/")
        time.sleep(2)
        page.screenshot(path=os.path.join(screenshot_dir, "garage.png"))

        # 7. More drawer menu
        print("Capturing More Drawer Menu...")
        page.goto("http://localhost:8000/dashboard/")
        time.sleep(2)
        # Click the mobile menu button
        page.click("button[aria-controls='mobile-more-menu']")
        time.sleep(1) # wait for open transition
        page.screenshot(path=os.path.join(screenshot_dir, "more_menu.png"))

        browser.close()
    print("Done capturing screenshots!")

if __name__ == "__main__":
    main()
