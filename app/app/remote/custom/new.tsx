import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, ChevronLeft } from 'lucide-react-native';

import { Theme } from '../../../src/constants/theme';
import { CustomRemoteAddingForm } from '../../../src/components/Remotes/CustomRemoteAddingForm';

export default function NewRemoteScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.root}>
      {/* ── Header ─────────────────────────────────────────────────── */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <View style={styles.headerInner}>
          <TouchableOpacity 
            style={styles.iconBtn} 
            onPress={() => router.back()} 
            activeOpacity={0.6}
          >
            <ChevronLeft size={20} color={Theme.colors.textPrimary} strokeWidth={2} />
          </TouchableOpacity>
          
          <View style={styles.headerTextStack}>
            <Text style={styles.headerLabel}>CREATOR</Text>
            <Text style={styles.headerTitle} numberOfLines={1}>Create New Remote</Text>
          </View>
        </View>
      </View>

      <View style={styles.body}>
        <CustomRemoteAddingForm />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  header: {
    backgroundColor: '#171717',
    borderBottomWidth: 1,
    borderBottomColor: '#2e2e2e',
  },
  headerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.sm + 2,
    minHeight: 56,
    gap: 12,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 6,
    backgroundColor: '#1c1c1c',
    borderWidth: 1,
    borderColor: '#2e2e2e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTextStack: {
    flex: 1,
  },
  headerLabel: {
    color: '#898989',
    fontSize: 12,
    fontWeight: '400',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  headerTitle: {
    color: '#fafafa',
    fontSize: 16,
    fontWeight: '400',
    letterSpacing: -0.16,
  },
  body: {
    flex: 1,
    paddingTop: Theme.spacing.lg,
  },
});
