class ToastStore {
  message = $state('');
  visible = $state(false);
  private timer: ReturnType<typeof setTimeout> | undefined;

  show(message: string, duration = 2200): void {
    this.message = message;
    this.visible = true;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.visible = false;
    }, duration);
  }
}

export const toast = new ToastStore();
