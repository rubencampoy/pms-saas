'use client';

interface StepIndicatorProps {
  currentStep: 1 | 2 | 3;
  translations: {
    step1: string;
    step2: string;
    step3: string;
  };
}

export function StepIndicator({ currentStep, translations: t }: StepIndicatorProps) {
  const steps = [
    { number: 1, label: t.step1 },
    { number: 2, label: t.step2 },
    { number: 3, label: t.step3 },
  ] as const;

  return (
    <div className="mb-10 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        {steps.map((step, index) => (
          <div key={step.number} className="contents">
            {/* Step circle + label */}
            <div className="flex flex-col items-center gap-2 z-10">
              <div
                className={`size-9 rounded-full flex items-center justify-center font-bold text-sm ${
                  step.number < currentStep
                    ? 'bg-primary text-white'
                    : step.number === currentStep
                      ? 'bg-primary text-white shadow-md shadow-primary/20'
                      : 'bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-slate-400'
                }`}
              >
                {step.number < currentStep ? (
                  <span className="material-icons text-lg">check</span>
                ) : (
                  step.number
                )}
              </div>
              <span
                className={`text-xs font-bold ${
                  step.number <= currentStep ? 'text-primary' : 'text-slate-400'
                }`}
              >
                {step.label}
              </span>
            </div>

            {/* Connector line (between steps, not after last) */}
            {index < steps.length - 1 && (
              <div className="h-0.5 flex-1 bg-slate-200 dark:bg-slate-800 mx-4 -mt-6">
                <div
                  className="h-full bg-primary transition-all duration-500"
                  style={{
                    width:
                      step.number < currentStep
                        ? '100%'
                        : step.number === currentStep
                          ? '50%'
                          : '0%',
                  }}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
