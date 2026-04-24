from locust import HttpUser, between, task


class MotoTrackUser(HttpUser):
    wait_time = between(1, 3)

    @task(3)
    def view_landing(self):
        self.client.get("/", name="landing")

    @task(2)
    def view_login(self):
        self.client.get("/accounts/login/", name="login")

    @task(1)
    def view_dashboard(self):
        with self.client.get("/dashboard/", name="dashboard", catch_response=True) as response:
            if response.status_code == 302:
                response.success()
            elif response.status_code != 200:
                response.failure(f"Unexpected status {response.status_code}")
