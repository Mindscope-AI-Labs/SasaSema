import React from 'react';
import styles from './ProgressBar.module.css';

interface ProgressBarProps {
  /** Current time in seconds (for audio progress) */
  currentTime?: number;
  /** Total duration in seconds (for audio progress) */
  duration?: number;
  /** Direct progress value (0-100), overrides currentTime/duration if provided */
  progress?: number;
  /** Additional CSS class names */
  className?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  currentTime = 0,
  duration = 0,
  progress: propProgress,
  className,
}) => {
  // Calculate progress as a percentage (0-100)
  const calculatedProgress = typeof propProgress === 'number' 
    ? Math.min(100, Math.max(0, propProgress))
    : (duration > 0 ? currentTime / duration * 100 : 0);
    
  const progressValue = Math.round(calculatedProgress);
  
  // Round to nearest 10% for the data-progress attribute
  const progressRounded = Math.min(100, Math.max(0, Math.round(progressValue / 10) * 10));
  
  // ARIA values - TypeScript expects numbers for these attributes
  const ariaValueNow = progressValue;
  const ariaValueMin = 0;
  const ariaValueMax = 100;
  
  return (
    <div 
      className={`${styles.progressBar} progress-bar ${className || ''}`}
      role="progressbar"
      aria-label="Audio progress"
      aria-valuenow={ariaValueNow}
      aria-valuemin={ariaValueMin}
      aria-valuemax={ariaValueMax}
      aria-valuetext={`${progressValue}%`}
      data-progress={progressRounded}
      data-testid="progress-bar"
    >
      <div
        className={styles.progressBarFill}
        data-progress={progressRounded}
      >
        <span className="sr-only">
          {progressValue}% played
        </span>
      </div>
    </div>
  );
};

export default ProgressBar;
