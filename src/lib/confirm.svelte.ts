class ConfirmStore {
  open = $state(false);
  message = $state('');
  confirmLabel = $state('Supprimer');
  private resolver: ((value: boolean) => void) | null = null;

  ask(message: string, confirmLabel = 'Supprimer'): Promise<boolean> {
    // Une seule demande à la fois
    this.resolver?.(false);
    this.message = message;
    this.confirmLabel = confirmLabel;
    this.open = true;
    return new Promise((resolve) => {
      this.resolver = resolve;
    });
  }

  answer(value: boolean): void {
    this.open = false;
    const resolver = this.resolver;
    this.resolver = null;
    resolver?.(value);
  }
}

export const confirmStore = new ConfirmStore();
