import { fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import KioskDeviceSetup from "@/components/KioskDeviceSetup";

afterEach(() => { vi.restoreAllMocks(); localStorage.clear(); });

it("retries denied camera access and stops camera/microphone streams after setup", async () => {
  const stop = vi.fn();
  const media = vi.fn().mockRejectedValueOnce(new Error("Denied")).mockResolvedValue({ getTracks: () => [{ stop }] });
  Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: media } });
  Object.defineProperty(navigator, "geolocation", { configurable: true, value: { getCurrentPosition: (success: () => void) => success() } });
  const view = render(<KioskDeviceSetup active voiceSupported />);
  fireEvent.click(view.getByRole("button", { name: "Set up camera, voice & location" }));
  await waitFor(() => expect(media).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(stop).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(view.getByRole("button", { name: "Set up camera, voice & location" })).not.toBeDisabled());
  fireEvent.click(view.getByRole("button", { name: "Set up camera, voice & location" }));
  await waitFor(() => expect(media).toHaveBeenCalledTimes(4));
  await waitFor(() => expect(stop).toHaveBeenCalledTimes(3));
});