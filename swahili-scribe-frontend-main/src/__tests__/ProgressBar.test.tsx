import { render, screen } from '@testing-library/react';
import { ProgressBar } from '../components/ProgressBar';
import { describe, it, expect } from 'vitest';

describe('ProgressBar', () => {
  it('renders with the correct progress value', () => {
    render(<ProgressBar progress={30} />);
    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toHaveAttribute('aria-valuenow', '30');
    expect(progressBar).toHaveAttribute('data-progress', '30');
  });

  it('has the correct CSS class based on progress', () => {
    render(<ProgressBar progress={30} />);
    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toHaveClass('progress-bar');
    expect(progressBar).toHaveAttribute('data-progress', '30');
  });

  it('handles edge cases for progress values', () => {
    // Test with 0% progress
    const { rerender } = render(<ProgressBar progress={0} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('data-progress', '0');

    // Test with 100% progress
    rerender(<ProgressBar progress={100} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('data-progress', '100');

    // Test with value > 100 (should be capped at 100)
    rerender(<ProgressBar progress={150} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('data-progress', '100');

    // Test with value < 0 (should be floored at 0)
    rerender(<ProgressBar progress={-50} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('data-progress', '0');
  });

  it('is accessible', () => {
    render(<ProgressBar progress={45} />);
    const progressBar = screen.getByRole('progressbar');
    
    // Check ARIA attributes
    expect(progressBar).toHaveAttribute('aria-valuemin', '0');
    expect(progressBar).toHaveAttribute('aria-valuemax', '100');
    expect(progressBar).toHaveAttribute('aria-valuenow', '45');
    expect(progressBar).toHaveAttribute('aria-valuetext', '45%');
  });
});
