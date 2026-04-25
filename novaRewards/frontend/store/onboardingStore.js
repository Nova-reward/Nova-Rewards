import { create } from 'zustand';
import { persist, devtools } from 'zustand/middleware';
import api from '../lib/api';

const TOTAL_STEPS = 4;

/**
 * onboardingStore tracks the 4-step guided onboarding flow.
 * Progress is persisted to localStorage and synced to the backend on completion.
 * Steps: 0=ConnectWallet, 1=CreateProfile, 2=ExploreCampaigns, 3=EarnFirstReward
 */
export const useOnboardingStore = create(
  devtools(
    persist(
      (set, get) => ({
        isOpen: false,
        currentStep: 0,
        completedSteps: [],   // array of completed step indices
        isDismissed: false,   // user explicitly skipped the whole flow
        isCompleted: false,   // all steps done

        /** Open the modal (only if not already completed/dismissed). */
        open: () => {
          const { isCompleted, isDismissed } = get();
          if (!isCompleted && !isDismissed) set({ isOpen: true }, false, 'onboarding/open');
        },

        close: () => set({ isOpen: false }, false, 'onboarding/close'),

        /** Mark current step complete and advance. */
        completeStep: (stepIndex) => {
          const { completedSteps } = get();
          if (completedSteps.includes(stepIndex)) return;
          const next = [...completedSteps, stepIndex];
          const allDone = next.length === TOTAL_STEPS;
          set(
            {
              completedSteps: next,
              currentStep: allDone ? stepIndex : stepIndex + 1,
              isCompleted: allDone,
              isOpen: !allDone,
            },
            false,
            'onboarding/completeStep'
          );
          if (allDone) get()._syncCompletion();
        },

        goToStep: (step) => set({ currentStep: step }, false, 'onboarding/goToStep'),

        /** Skip the entire flow without completing it. */
        dismiss: () =>
          set({ isDismissed: true, isOpen: false }, false, 'onboarding/dismiss'),

        /** Reset — useful for testing or re-triggering. */
        reset: () =>
          set(
            { isOpen: false, currentStep: 0, completedSteps: [], isDismissed: false, isCompleted: false },
            false,
            'onboarding/reset'
          ),

        /** POST completion to backend (fire-and-forget; failures are silent). */
        _syncCompletion: async () => {
          try {
            await api.post('/api/users/onboarding/complete');
          } catch {
            // non-critical — localStorage already records completion
          }
        },
      }),
      {
        name: 'nova-onboarding',
        partialize: (s) => ({
          currentStep: s.currentStep,
          completedSteps: s.completedSteps,
          isDismissed: s.isDismissed,
          isCompleted: s.isCompleted,
        }),
      }
    ),
    { name: 'OnboardingStore' }
  )
);
