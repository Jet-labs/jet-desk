/**
 * ErrorBoundary — Catches UI component failures and renders a fallback
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { AlertTriangle } from 'lucide-react-native';
import { Theme } from '../constants/theme';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[ErrorBoundary] Caught error:', error, info.componentStack);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <View style={styles.container}>
          <View style={styles.card}>
            <View style={styles.iconWrap}>
              <AlertTriangle size={48} color={Theme.colors.error} strokeWidth={1.5} />
            </View>
            <Text style={styles.title}>Something went wrong</Text>
            <Text style={styles.message}>
              {this.state.error?.message || 'An unexpected error occurred'}
            </Text>
            <TouchableOpacity style={styles.button} onPress={this.handleReset}>
              <Text style={styles.buttonText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Theme.spacing.lg,
  },
  card: {
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.radius.lg,
    padding: Theme.spacing.xl,
    alignItems: 'center',
    width: '100%',
    maxWidth: 340,
  },
  iconWrap: {
    marginBottom: Theme.spacing.md,
  },
  title: {
    color: Theme.colors.textPrimary,
    fontSize: Theme.fontSize.h2,
    fontWeight: Theme.fontWeight.bold,
    marginBottom: Theme.spacing.sm,
    textAlign: 'center',
  },
  message: {
    color: Theme.colors.textSecondary,
    fontSize: Theme.fontSize.body,
    textAlign: 'center',
    marginBottom: Theme.spacing.lg,
    lineHeight: 22,
  },
  button: {
    backgroundColor: Theme.colors.accent,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: Theme.radius.full,
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: Theme.fontWeight.semiBold,
    fontSize: Theme.fontSize.sm,
  },
});
