
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Avatar from './Avatar';

describe('Avatar component', () => {
  it('displays the initials of a full name', () => {
    render(<Avatar name="John Doe" />);

    expect(screen.getByText('JD')).toBeInTheDocument();
  });

  it('displays one initial for a single name', () => {
    render(<Avatar name="Priyanka" />);

    expect(screen.getByText('P')).toBeInTheDocument();
  });

  it('displays U when the name is missing', () => {
    render(<Avatar />);

    expect(screen.getByText('U')).toBeInTheDocument();
  });

  it('applies the medium size by default', () => {
    render(<Avatar name="John Doe" />);

    expect(screen.getByText('JD')).toHaveClass('avatar-md');
  });

  it('applies a custom avatar size', () => {
    render(<Avatar name="John Doe" size="lg" />);

    expect(screen.getByText('JD')).toHaveClass('avatar-lg');
  });
});
