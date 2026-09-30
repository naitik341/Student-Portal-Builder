import React, { useMemo, useRef, useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { useQueryClient } from '@tanstack/react-query';
import { Link } from 'expo-router';
import {
  getGetManagedMenuQueryKey,
  getGetMenuQueryKey,
  getGetSettingsQueryKey,
  useCreateMenuItem,
  useDeleteMenuItem,
  useGetManagedMenu,
  useGetSettings,
  useReorderMenuItems,
  useUpdateMenuItem,
  useUpdateSettings,
} from '@workspace/api-client-react';
import { ItemCard } from '@/components/ItemSelect';

type Meal = 'Breakfast' | 'Lunch' | 'Dinner';
type ApiMenuItem = {
  id: number;
  name: string;
  imageData: string | null;
  isVeg: boolean;
  meals: Meal[];
  sortOrder: number;
  active: boolean;
};
type MenuItemCreatePayload = {
  name: string;
  imageData: string | null;
  isVeg: boolean;
  meals: Meal[];
  sortOrder?: number;
  active?: boolean;
};
const C = {
  cream: '#F1ECEC',
  orange: '#F06A14',
  orangePressed: '#D9570A',
  ink: '#000000',
  white: '#FCFCFC',
  muted: '#756B69',
  line: '#D7CECC',
  veg: '#118A1A',
  nonVeg: '#D9151B',
  danger: '#B9141A',
};
const BOLD = 'ArchivoBlack_400Regular';
const MAX_IMAGE_DATA_CHARS = 1_800_000;
const meals: Meal[] = ['Breakfast', 'Lunch', 'Dinner'];
type MealTab = 'All' | Meal;
type MenuDraft = {
  id?: number;
  name: string;
  imageData: string | null;
  isVeg: boolean;
  meals: Meal[];
  active: boolean;
  sortOrder: number;
};

function statusOf(error: unknown) {
  return typeof error === 'object' && error !== null && 'status' in error
    ? Number((error as { status?: unknown }).status)
    : 0;
}

function errorMessage(error: unknown) {
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String((error as { message?: unknown }).message ?? 'Please try again.');
  }
  return 'Please try again.';
}

function PressButton({
  children,
  onPress,
  testID,
  style,
  accessibilityLabel,
  disabled,
}: {
  children: React.ReactNode;
  onPress: () => void;
  testID: string;
  style?: object;
  accessibilityLabel?: string;
  disabled?: boolean;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [style, pressed && styles.pressed, disabled && styles.disabled]}
    >
      {children}
    </Pressable>
  );
}

async function optimizeImageData(uri: string, base64?: string | null, mimeType = 'image/jpeg'): Promise<string> {
  const source = uri.startsWith('data:') ? uri : `data:${mimeType};base64,${base64 ?? ''}`;
  if (!source || source.endsWith(',')) throw new Error('The selected image could not be read.');
  if (Platform.OS !== 'web') return source;
  const optimized = await new Promise<string>((resolve, reject) => {
    const image = new globalThis.Image();
    image.onload = () => {
      const ratio = Math.min(1, 600 / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
      const context = canvas.getContext('2d');
      if (!context) {
        reject(new Error('This browser cannot resize images.'));
        return;
      }
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/webp', 0.82));
    };
    image.onerror = () => reject(new Error('The selected image could not be opened.'));
    image.src = source;
  });
  if (optimized.length > MAX_IMAGE_DATA_CHARS) {
    throw new Error('This image is still too large after optimization. Choose a smaller image.');
  }
  return optimized;
}

async function optimizeNativeImage(uri: string, sourceWidth: number, sourceHeight: number): Promise<string> {
  if (!sourceWidth || !sourceHeight || !Number.isFinite(sourceWidth) || !Number.isFinite(sourceHeight)) {
    throw new Error('The selected photo dimensions could not be read. Choose another image.');
  }
  const maxSide = Math.max(sourceWidth, sourceHeight);
  const initialScale = Math.min(1, 600 / maxSide);
  const attempts = [
    { scale: 1, quality: 0.72 },
    { scale: 1, quality: 0.5 },
    { scale: 1, quality: 0.32 },
    { scale: 0.8, quality: 0.5 },
    { scale: 0.64, quality: 0.45 },
    { scale: 0.5, quality: 0.4 },
    { scale: 0.4, quality: 0.35 },
    { scale: 0.3, quality: 0.3 },
    { scale: 0.2, quality: 0.25 },
  ];
  for (const attempt of attempts) {
    const width = Math.max(1, Math.round(sourceWidth * initialScale * attempt.scale));
    const height = Math.max(1, Math.round(sourceHeight * initialScale * attempt.scale));
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width, height } }],
      {
        compress: attempt.quality,
        format: ImageManipulator.SaveFormat.WEBP,
        base64: true,
      },
    );
    if (!result.base64) {
      throw new Error('The resized photo could not be encoded. Choose another image.');
    }
    const dataUrl = `data:image/webp;base64,${result.base64}`;
    if (Math.max(result.width, result.height) <= 600 && dataUrl.length <= MAX_IMAGE_DATA_CHARS) {
      return dataUrl;
    }
  }
  throw new Error('This photo could not be compressed below the 1.8 MB upload limit. Choose a smaller image.');
}

async function readWebImage(file: File) {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
    throw new Error('Choose a PNG, JPG, or WebP image.');
  }
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('The selected image could not be read.'));
    reader.readAsDataURL(file);
  });
  return optimizeImageData(dataUrl);
}

const blankDraft = (sortOrder: number): MenuDraft => ({
  name: '',
  imageData: null,
  isVeg: true,
  meals: [],
  active: true,
  sortOrder,
});

export default function MenuManager() {
  const { width: windowWidth } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && windowWidth >= 900;
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<MealTab>('All');
  const menuQuery = useGetManagedMenu();
  const settingsQuery = useGetSettings();
  const createMutation = useCreateMenuItem();
  const updateMutation = useUpdateMenuItem();
  const deleteMutation = useDeleteMenuItem();
  const reorderMutation = useReorderMenuItems();
  const saveSettingsMutation = useUpdateSettings();
  const [draft, setDraft] = useState<MenuDraft | null>(null);
  const [formError, setFormError] = useState('');
  const [permissionError, setPermissionError] = useState(false);
  const [toast, setToast] = useState<{ message: string; undo?: MenuDraft } | null>(null);
  const [line1, setLine1] = useState('');
  const [line2, setLine2] = useState('');
  const [settingsDirty, setSettingsDirty] = useState(false);
  const [settingsError, setSettingsError] = useState('');
  const [uploading, setUploading] = useState(false);
  const dropRef = useRef<View>(null);
  const fullItems = useMemo(
    () => [...(menuQuery.data ?? [])].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id),
    [menuQuery.data],
  );
  const visibleItems = useMemo(
    () => tab === 'All' ? fullItems : fullItems.filter(item => item.meals.includes(tab)),
    [fullItems, tab],
  );
  const previewItems = useMemo(() => {
    if (!draft) return fullItems;
    const editablePreview: ApiMenuItem = {
      id: draft.id ?? -1,
      name: draft.name || 'NEW ITEM',
      imageData: draft.imageData,
      isVeg: draft.isVeg,
      meals: draft.meals,
      sortOrder: draft.sortOrder,
      active: draft.active,
    };
    return draft.id
      ? fullItems.map(item => item.id === draft.id ? editablePreview : item)
      : [...fullItems, editablePreview];
  }, [draft, fullItems]);
  const serverSettings = settingsQuery.data;
  const headingOne = settingsDirty ? line1 : (serverSettings?.headingLine1 ?? 'WHAT DID YOU');
  const headingTwo = settingsDirty ? line2 : (serverSettings?.headingLine2 ?? 'ORDER?');
  const forbidden = permissionError || statusOf(menuQuery.error) === 403 || statusOf(settingsQuery.error) === 403;

  const invalidateData = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: getGetManagedMenuQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getGetMenuQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getGetSettingsQueryKey() }),
    ]);
  };
  const reportMutationError = (error: unknown) => {
    if (statusOf(error) === 403) setPermissionError(true);
    setFormError(statusOf(error) === 403
      ? 'Your account is signed in, but it is not authorized as a MessMate manager. Ask an administrator to add your verified email to MANAGER_EMAILS.'
      : errorMessage(error));
  };
  const notify = (message: string, undo?: MenuDraft) => {
    setToast({ message, undo });
    setTimeout(() => setToast(current => current?.message === message ? null : current), 4500);
  };

  const openExisting = (item: ApiMenuItem) => {
    setFormError('');
    setDraft({
      id: item.id,
      name: item.name,
      imageData: item.imageData,
      isVeg: item.isVeg,
      meals: [...item.meals],
      active: item.active,
      sortOrder: item.sortOrder,
    });
  };

  const persistOrder = async (newOrder: ApiMenuItem[]) => {
    const ids = newOrder.map(item => item.id);
    if (!ids.length) return;
    try {
      await reorderMutation.mutateAsync({ data: { ids } });
      await invalidateData();
      notify('Menu order saved');
    } catch (error) {
      reportMutationError(error);
    }
  };

  const moveItem = (id: number, offset: number) => {
    const from = fullItems.findIndex(item => item.id === id);
    const to = from + offset;
    if (from < 0 || to < 0 || to >= fullItems.length) return;
    const reordered = [...fullItems];
    const [item] = reordered.splice(from, 1);
    reordered.splice(to, 0, item);
    void persistOrder(reordered);
  };

  const pickImage = async () => {
    setUploading(true);
    setFormError('');
    try {
      if (Platform.OS === 'web') {
        await new Promise<void>((resolve, reject) => {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = 'image/png,image/jpeg,image/webp';
          input.onchange = async () => {
            const file = input.files?.[0];
            if (!file) { resolve(); return; }
            if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
              reject(new Error('Choose a PNG, JPG, or WebP image.'));
              return;
            }
            void readWebImage(file).then(optimized => {
              setDraft(current => current ? { ...current, imageData: optimized } : current);
              resolve();
            }, reject);
          };
          input.click();
        });
      } else {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) throw new Error('Allow photo library access to add a menu image.');
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsEditing: false,
          base64: false,
          quality: 1,
        });
        if (!result.canceled && result.assets[0]) {
          const asset = result.assets[0];
          const data = await optimizeNativeImage(asset.uri, asset.width, asset.height);
          setDraft(current => current ? { ...current, imageData: data } : current);
        }
      }
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Image upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const saveDraft = async () => {
    if (!draft) return;
    const name = draft.name.trim();
    if (!name) { setFormError('Enter an item name.'); return; }
    if (!draft.meals.length) { setFormError('Choose at least one meal for this item.'); return; }
    setFormError('');
    const payload: MenuItemCreatePayload = {
      name,
      imageData: draft.imageData,
      isVeg: draft.isVeg,
      meals: draft.meals,
      sortOrder: draft.sortOrder,
      active: draft.active,
    };
    try {
      if (draft.id) await updateMutation.mutateAsync({ id: draft.id, data: { ...payload, sortOrder: draft.sortOrder, active: draft.active } });
      else await createMutation.mutateAsync({ data: payload });
      await invalidateData();
      setDraft(null);
      notify(draft.id ? 'Item saved' : 'Item added');
    } catch (error) {
      reportMutationError(error);
    }
  };

  const deleteDraft = () => {
    if (!draft?.id) { setDraft(null); return; }
    const itemToRestore = { ...draft };
    const confirmDelete = async () => {
      try {
        await deleteMutation.mutateAsync({ id: itemToRestore.id! });
        await invalidateData();
        setDraft(null);
        notify(`${itemToRestore.name} deleted`, itemToRestore);
      } catch (error) { reportMutationError(error); }
    };
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm(`Delete "${itemToRestore.name}" from the menu?`)) void confirmDelete();
    } else {
      Alert.alert('Delete menu item?', `Delete “${itemToRestore.name}”?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => { void confirmDelete(); } },
      ]);
    }
  };

  const undoDelete = async () => {
    const deleted = toast?.undo;
    if (!deleted) return;
    try {
      const payload: MenuItemCreatePayload = {
        name: deleted.name,
        imageData: deleted.imageData,
        isVeg: deleted.isVeg,
        meals: deleted.meals,
        sortOrder: deleted.sortOrder,
        active: deleted.active,
      };
      await createMutation.mutateAsync({ data: payload });
      await invalidateData();
      setToast(null);
    } catch (error) { reportMutationError(error); }
  };

  const saveHeadings = async () => {
    const nextLine1 = line1.trim();
    const nextLine2 = line2.trim();
    if (!nextLine1 || !nextLine2) { setSettingsError('Both screen headings are required.'); return; }
    setSettingsError('');
    try {
      await saveSettingsMutation.mutateAsync({ data: { headingLine1: nextLine1, headingLine2: nextLine2 } });
      await invalidateData();
      setSettingsDirty(false);
      notify('Screen text saved');
    } catch (error) {
      if (statusOf(error) === 403) setPermissionError(true);
      setSettingsError(statusOf(error) === 403
        ? 'Your account is signed in, but it is not authorized as a manager. Ask an administrator to add your verified email to MANAGER_EMAILS.'
        : errorMessage(error));
    }
  };

  const dragHandlers = (itemId: number) => Platform.OS !== 'web' ? {} : ({
    draggable: true,
    onDragStart: (event: { dataTransfer?: { setData: (type: string, value: string) => void; effectAllowed?: string } }) => {
      event.dataTransfer?.setData('text/plain', String(itemId));
      if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
    },
    onDragOver: (event: { preventDefault: () => void }) => event.preventDefault(),
    onDrop: (event: { preventDefault: () => void; dataTransfer?: { getData: (type: string) => string } }) => {
      event.preventDefault();
      const fromId = Number(event.dataTransfer?.getData('text/plain'));
      if (!fromId || fromId === itemId) return;
      const reordered = [...fullItems];
      const from = reordered.findIndex(item => item.id === fromId);
      const to = reordered.findIndex(item => item.id === itemId);
      if (from < 0 || to < 0) return;
      const [dragged] = reordered.splice(from, 1);
      reordered.splice(to, 0, dragged);
      void persistOrder(reordered);
    },
  });

  if (forbidden) {
    return (
      <View style={styles.denied} testID="manager-menu-forbidden">
        <View style={styles.deniedIcon}><Ionicons name="lock-closed" size={30} color={C.orange} /></View>
        <Text style={styles.deniedTitle}>MANAGER ACCESS REQUIRED</Text>
        <Text style={styles.deniedCopy}>You are signed in, but this verified email is not authorized to manage the menu. Ask the site administrator to add it to MANAGER_EMAILS.</Text>
        <PressButton testID="manager-menu-retry" onPress={() => { setPermissionError(false); void menuQuery.refetch(); void settingsQuery.refetch(); }} style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>TRY AGAIN</Text>
        </PressButton>
      </View>
    );
  }

  const busy = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  return (
    <View style={styles.screen} testID="manager-menu-screen">
      <View style={styles.workspace}>
        <ScrollView
          style={styles.managerColumn}
          contentContainerStyle={[styles.content, Platform.OS === 'web' && styles.webInsets]}
          keyboardShouldPersistTaps="handled"
          testID="manager-menu-scroll"
        >
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.eyebrow}>MESSMATE / MANAGER</Text>
              <Text style={styles.pageTitle}>MENU MANAGER</Text>
            </View>
            <View style={styles.headerActions}>
              <Link href="/manager" asChild>
                <Pressable testID="manager-menu-dashboard-link" accessibilityRole="link" style={({ pressed }) => [styles.dashboardLink, pressed && styles.pressed]}>
                  <Ionicons name="arrow-back" size={16} color={C.ink} />
                  <Text style={styles.dashboardLinkText}>DASHBOARD</Text>
                </Pressable>
              </Link>
              <View style={styles.countBadge}><Text style={styles.countText}>{fullItems.length} ITEMS</Text></View>
            </View>
          </View>

          <View style={styles.tabs} testID="manager-menu-meal-tabs">
            {(['All', ...meals] as MealTab[]).map(meal => (
              <Pressable
                key={meal}
                testID={`manager-menu-tab-${meal.toLowerCase()}`}
                accessibilityRole="tab"
                accessibilityState={{ selected: tab === meal }}
                onPress={() => setTab(meal)}
                style={({ pressed }) => [styles.tab, tab === meal && styles.activeTab, pressed && styles.pressed]}
              >
                <Text style={[styles.tabText, tab === meal && styles.activeTabText]}>{meal}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.instruction}>Tap a card to edit · Drag or use arrows to reorder</Text>

          {menuQuery.isLoading ? (
            <View style={styles.statePanel}><Text style={styles.stateTitle}>LOADING YOUR MENU…</Text></View>
          ) : menuQuery.error ? (
            <View style={styles.statePanel} testID="manager-menu-load-error">
              <Text style={styles.stateTitle}>COULDN'T LOAD THE MENU</Text>
              <Text style={styles.stateCopy}>{errorMessage(menuQuery.error)}</Text>
              <PressButton testID="manager-menu-retry-load" onPress={() => { void menuQuery.refetch(); }} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>RETRY</Text></PressButton>
            </View>
          ) : visibleItems.length === 0 ? (
            <View style={styles.statePanel} testID="manager-menu-empty">
              <Ionicons name="restaurant-outline" size={36} color={C.orange} />
              <Text style={styles.stateTitle}>NOTHING HERE YET</Text>
              <Text style={styles.stateCopy}>Add an item and choose the meals where students can see it.</Text>
            </View>
          ) : (
            <View style={styles.grid} testID="manager-menu-grid">
              {visibleItems.map(item => (
                <View
                  key={item.id}
                  ref={item.id === visibleItems[0]?.id ? dropRef : undefined}
                  testID={`manager-menu-row-${item.id}`}
                  {...(dragHandlers(item.id) as object)}
                  style={styles.gridCell}
                >
                  <ItemCard item={item} selected={false} editable onPress={() => openExisting(item)} />
                  <View style={styles.reorderControls}>
                    <PressButton testID={`manager-menu-up-${item.id}`} accessibilityLabel={`Move ${item.name} up`} disabled={fullItems[0]?.id === item.id || reorderMutation.isPending} onPress={() => moveItem(item.id, -1)} style={styles.moveButton}>
                      <Ionicons name="arrow-up" size={17} color={C.ink} />
                    </PressButton>
                    <PressButton testID={`manager-menu-down-${item.id}`} accessibilityLabel={`Move ${item.name} down`} disabled={fullItems[fullItems.length - 1]?.id === item.id || reorderMutation.isPending} onPress={() => moveItem(item.id, 1)} style={styles.moveButton}>
                      <Ionicons name="arrow-down" size={17} color={C.ink} />
                    </PressButton>
                  </View>
                  {!item.active && <View pointerEvents="none" style={styles.inactiveTag}><Text style={styles.inactiveText}>HIDDEN</Text></View>}
                </View>
              ))}
            </View>
          )}

          <View style={styles.settingsCard} testID="manager-screen-text">
            <View style={styles.settingsHeading}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sectionKicker}>STUDENT ITEM SELECT</Text>
                <Text style={styles.sectionTitle}>SCREEN TEXT</Text>
              </View>
              <Ionicons name="create-outline" size={22} color={C.orange} />
            </View>
            <Text style={styles.fieldLabel}>HEADING LINE 1</Text>
            <TextInput
              testID="manager-heading-line1"
              value={headingOne}
              onChangeText={value => { setLine1(value); setLine2(settingsDirty ? line2 : (serverSettings?.headingLine2 ?? 'ORDER?')); setSettingsDirty(true); }}
              maxLength={60}
              placeholder="WHAT DID YOU"
              style={styles.input}
            />
            <Text style={styles.fieldLabel}>HEADING LINE 2</Text>
            <TextInput
              testID="manager-heading-line2"
              value={headingTwo}
              onChangeText={value => { setLine2(value); setLine1(settingsDirty ? line1 : (serverSettings?.headingLine1 ?? 'WHAT DID YOU')); setSettingsDirty(true); }}
              maxLength={60}
              placeholder="ORDER?"
              style={styles.input}
            />
            {!!settingsError && <Text style={styles.errorText} accessibilityRole="alert">{settingsError}</Text>}
            <PressButton testID="manager-save-screen-text" onPress={() => { void saveHeadings(); }} disabled={!settingsDirty || saveSettingsMutation.isPending} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>{saveSettingsMutation.isPending ? 'SAVING…' : 'SAVE SCREEN TEXT'}</Text>
            </PressButton>
          </View>
        </ScrollView>

        <View style={[styles.addDock, Platform.OS === 'web' && styles.webBottomInset]}>
          <PressButton
            testID="manager-add-item"
            accessibilityLabel="Add menu item"
            onPress={() => { setFormError(''); setDraft(blankDraft(fullItems.length ? Math.max(...fullItems.map(item => item.sortOrder)) + 1 : 0)); }}
            style={styles.addButton}
          >
            <Ionicons name="add" size={24} color={C.white} />
            <Text style={styles.addButtonText}>ADD ITEM</Text>
          </PressButton>
        </View>

        {isDesktop && (
          <View style={styles.previewColumn} testID="manager-live-preview">
            <View style={styles.previewHeading}>
              <Text style={styles.sectionKicker}>LIVE STUDENT PREVIEW</Text>
              <Text style={styles.previewTitle}>ITEM SELECT</Text>
            </View>
            <View style={styles.phoneFrame}>
              <View style={styles.phoneTop}><View style={styles.phoneNotch} /></View>
              <ScrollView contentContainerStyle={styles.phoneContent} showsVerticalScrollIndicator={false}>
                <Text numberOfLines={2} style={styles.previewLine1}>{headingOne.toUpperCase()}</Text>
                <Text numberOfLines={1} style={styles.previewLine2}>{headingTwo.toUpperCase()}</Text>
                <View style={styles.previewGrid}>
                  {(tab === 'All' ? previewItems : previewItems.filter(item => item.meals.includes(tab))).filter(item => item.active).map(item => (
                    <View key={item.id} style={styles.previewCell}>
                      <ItemCard item={item} selected={false} onPress={() => undefined} reduceMotion />
                    </View>
                  ))}
                </View>
              </ScrollView>
              <View style={styles.phoneFooter}><Text style={styles.phoneFooterText}>PROCEED</Text></View>
            </View>
            <Text style={styles.previewHint}>Preview updates as your headings, meal assignment, and images change.</Text>
          </View>
        )}
      </View>

      {toast && (
        <View style={styles.toast} testID="manager-menu-toast" accessibilityRole="alert">
          <Text style={styles.toastMessage}>{toast.message}</Text>
          {toast.undo && <PressButton testID="manager-menu-undo" onPress={() => { void undoDelete(); }} style={styles.undoButton}><Text style={styles.undoText}>UNDO</Text></PressButton>}
          <PressButton testID="manager-menu-toast-close" accessibilityLabel="Dismiss notification" onPress={() => setToast(null)} style={styles.dismissButton}><Ionicons name="close" size={18} color={C.white} /></PressButton>
        </View>
      )}

      <Modal visible={!!draft} transparent animationType={Platform.OS === 'web' ? 'fade' : 'slide'} onRequestClose={() => setDraft(null)}>
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setDraft(null)} accessibilityLabel="Close editor" />
          <View style={[styles.sheet, isDesktop && styles.desktopDialog]} testID="manager-item-editor">
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sectionKicker}>{draft?.id ? 'EDIT MENU ITEM' : 'NEW MENU ITEM'}</Text>
                <Text style={styles.sheetTitle}>{draft?.id ? 'MAKE IT RIGHT' : 'ADD TO MENU'}</Text>
              </View>
              <PressButton testID="manager-editor-close" accessibilityLabel="Close editor" onPress={() => setDraft(null)} style={styles.closeButton}><Ionicons name="close" size={21} color={C.ink} /></PressButton>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.formContent}>
              <View style={styles.formLabelRow}>
                <Text style={styles.fieldLabel}>ITEM NAME</Text>
                <Text style={styles.counter}>{draft?.name.length ?? 0}/20</Text>
              </View>
              <TextInput
                testID="manager-item-name"
                value={draft?.name ?? ''}
                onChangeText={name => setDraft(current => current ? { ...current, name } : current)}
                maxLength={20}
                placeholder="e.g. Chole Platter"
                placeholderTextColor="#8A817F"
                style={styles.input}
                autoCapitalize="words"
              />

              <Text style={styles.fieldLabel}>ITEM IMAGE</Text>
              <Pressable
                testID="manager-image-upload"
                onPress={() => { void pickImage(); }}
                {...(Platform.OS === 'web' ? {
                  onDragOver: (event: { preventDefault: () => void }) => event.preventDefault(),
                  onDrop: (event: { preventDefault: () => void; dataTransfer?: { files?: FileList } }) => {
                    event.preventDefault();
                    const file = event.dataTransfer?.files?.[0];
                    if (!file) return;
                    setUploading(true);
                    setFormError('');
                    void readWebImage(file).then(imageData => setDraft(current => current ? { ...current, imageData } : current))
                      .catch(error => setFormError(error instanceof Error ? error.message : 'Image upload failed.'))
                      .finally(() => setUploading(false));
                  },
                } as object : {})}
                style={({ pressed }) => [styles.uploadBox, pressed && styles.pressed]}
              >
                <View style={styles.imagePreview}>
                  <View style={styles.previewOrange} />
                  {draft?.imageData
                    ? <Image source={{ uri: draft.imageData }} resizeMode="contain" style={styles.uploadImage} />
                    : <Text style={styles.uploadEmoji}>🍽️</Text>}
                </View>
                <View style={styles.uploadCopy}>
                  <Text style={styles.uploadTitle}>{uploading ? 'PREPARING IMAGE…' : 'TAP TO UPLOAD'}</Text>
                  <Text style={styles.uploadHint}>PNG, JPG or WebP · optimized to 600px on web</Text>
                </View>
                <Ionicons name="cloud-upload-outline" size={22} color={C.orange} />
              </Pressable>
              <Text style={styles.tipText}>Use a transparent PNG for the pop-out look. On mobile, image size is reduced with picker quality settings.</Text>
              {draft?.imageData && <PressButton testID="manager-image-remove" onPress={() => setDraft(current => current ? { ...current, imageData: null } : current)} style={styles.removeImage}><Text style={styles.removeImageText}>REMOVE IMAGE</Text></PressButton>}

              <Text style={styles.fieldLabel}>DIETARY TYPE</Text>
              <View style={styles.toggleRow}>
                <Pressable testID="manager-veg-toggle" accessibilityRole="radio" accessibilityState={{ selected: !!draft?.isVeg }} onPress={() => setDraft(current => current ? { ...current, isVeg: true } : current)} style={({ pressed }) => [styles.dietChoice, draft?.isVeg && styles.dietChoiceSelected, pressed && styles.pressed]}>
                  <View style={[styles.dietMark, { borderColor: C.veg }]}><View style={[styles.dietDot, { backgroundColor: C.veg }]} /></View>
                  <Text style={styles.dietText}>VEG</Text>
                </Pressable>
                <Pressable testID="manager-nonveg-toggle" accessibilityRole="radio" accessibilityState={{ selected: draft?.isVeg === false }} onPress={() => setDraft(current => current ? { ...current, isVeg: false } : current)} style={({ pressed }) => [styles.dietChoice, draft?.isVeg === false && styles.dietChoiceSelected, pressed && styles.pressed]}>
                  <View style={[styles.dietMark, { borderColor: C.nonVeg }]}><View style={[styles.dietDot, { backgroundColor: C.nonVeg }]} /></View>
                  <Text style={styles.dietText}>NON-VEG</Text>
                </Pressable>
              </View>

              <Text style={styles.fieldLabel}>SHOW IN</Text>
              <View style={styles.mealChips}>
                {meals.map(meal => {
                  const selected = !!draft?.meals.includes(meal);
                  return (
                    <Pressable
                      key={meal}
                      testID={`manager-item-meal-${meal.toLowerCase()}`}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: selected }}
                      onPress={() => setDraft(current => current ? { ...current, meals: selected ? current.meals.filter(value => value !== meal) : [...current.meals, meal] } : current)}
                      style={({ pressed }) => [styles.mealChip, selected && styles.mealChipSelected, pressed && styles.pressed]}
                    >
                      <Text style={[styles.mealChipText, selected && styles.mealChipTextSelected]}>{meal.toUpperCase()}</Text>
                      {selected && <Ionicons name="checkmark" size={15} color={C.white} />}
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.activeRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>ACTIVE</Text>
                  <Text style={styles.activeHint}>{draft?.active ? 'Visible to students' : 'Hidden from student screens'}</Text>
                </View>
                <Switch testID="manager-item-active" value={draft?.active ?? true} onValueChange={active => setDraft(current => current ? { ...current, active } : current)} trackColor={{ false: '#B9B0AE', true: C.orange }} thumbColor={C.white} />
              </View>

              {!!formError && <Text style={styles.errorText} accessibilityRole="alert" testID="manager-item-error">{formError}</Text>}
              <PressButton testID="manager-save-item" onPress={() => { void saveDraft(); }} disabled={busy || uploading} style={styles.primaryButton}>
                <Text style={styles.primaryButtonText}>{busy ? 'SAVING…' : 'SAVE ITEM'}</Text>
              </PressButton>
              {draft?.id && (
                <PressButton testID="manager-delete-item" onPress={deleteDraft} disabled={busy} style={styles.deleteButton}>
                  <Ionicons name="trash-outline" size={18} color={C.danger} />
                  <Text style={styles.deleteText}>{deleteMutation.isPending ? 'DELETING…' : 'DELETE ITEM'}</Text>
                </PressButton>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.cream },
  workspace: { flex: 1, flexDirection: 'row', maxWidth: 1440, width: '100%', alignSelf: 'center' },
  managerColumn: { flex: 1, minWidth: 0 },
  content: { paddingHorizontal: 22, paddingTop: 26, paddingBottom: 132, maxWidth: 790, width: '100%', alignSelf: 'center' },
  webInsets: { paddingTop: 67, paddingBottom: 138 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 23 },
  headerActions: { alignItems: 'flex-end', gap: 8 },
  dashboardLink: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 30, paddingHorizontal: 8, borderRadius: 12 },
  dashboardLinkText: { color: C.ink, fontFamily: BOLD, fontSize: 9 },
  eyebrow: { fontFamily: BOLD, color: C.orange, fontSize: 11, letterSpacing: 1.1, marginBottom: 5 },
  pageTitle: { fontFamily: BOLD, color: C.ink, fontSize: 30, lineHeight: 36, letterSpacing: -1 },
  countBadge: { backgroundColor: C.ink, borderRadius: 20, paddingHorizontal: 13, paddingVertical: 9 },
  countText: { color: C.white, fontFamily: BOLD, fontSize: 10, letterSpacing: 0.5 },
  tabs: { flexDirection: 'row', padding: 4, borderWidth: 2, borderColor: C.ink, borderRadius: 19, backgroundColor: C.white, marginBottom: 13 },
  tab: { flex: 1, minHeight: 43, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  activeTab: { backgroundColor: C.orange },
  tabText: { color: C.ink, fontFamily: BOLD, fontSize: 11 },
  activeTabText: { color: C.white },
  instruction: { color: C.muted, fontSize: 12, marginBottom: 20 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 18, rowGap: 28, justifyContent: 'flex-start', marginBottom: 30 },
  gridCell: { width: '47%', maxWidth: 250, height: 208, position: 'relative' },
  reorderControls: { position: 'absolute', left: 7, bottom: 0, flexDirection: 'row', gap: 7 },
  moveButton: { width: 32, height: 29, borderWidth: 1.5, borderColor: C.ink, borderRadius: 10, backgroundColor: C.white, alignItems: 'center', justifyContent: 'center' },
  inactiveTag: { position: 'absolute', left: 5, top: 7, backgroundColor: C.ink, borderRadius: 9, paddingHorizontal: 7, paddingVertical: 4 },
  inactiveText: { color: C.white, fontFamily: BOLD, fontSize: 8 },
  statePanel: { minHeight: 190, borderWidth: 2, borderColor: C.ink, borderRadius: 20, backgroundColor: C.white, alignItems: 'center', justifyContent: 'center', padding: 24, marginBottom: 25 },
  stateTitle: { fontFamily: BOLD, fontSize: 16, textAlign: 'center', color: C.ink, marginTop: 12 },
  stateCopy: { color: C.muted, textAlign: 'center', lineHeight: 21, marginTop: 8 },
  settingsCard: { backgroundColor: C.white, borderWidth: 2, borderColor: C.ink, borderRadius: 20, padding: 17, marginBottom: 20 },
  settingsHeading: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  sectionKicker: { color: C.orange, fontFamily: BOLD, fontSize: 10, letterSpacing: 0.8 },
  sectionTitle: { color: C.ink, fontFamily: BOLD, fontSize: 20, marginTop: 3 },
  fieldLabel: { color: C.ink, fontFamily: BOLD, fontSize: 11, letterSpacing: 0.4, marginBottom: 7, marginTop: 15 },
  input: { borderWidth: 1.5, borderColor: C.ink, borderRadius: 12, backgroundColor: C.white, minHeight: 46, paddingHorizontal: 13, paddingVertical: 10, color: C.ink, fontSize: 15 },
  secondaryButton: { minHeight: 43, marginTop: 13, paddingHorizontal: 18, borderWidth: 2, borderColor: C.ink, borderRadius: 16, backgroundColor: C.cream, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start' },
  secondaryButtonText: { color: C.ink, fontFamily: BOLD, fontSize: 11 },
  addDock: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 18, paddingTop: 12, paddingBottom: 20, backgroundColor: C.cream },
  webBottomInset: { paddingBottom: 34 },
  addButton: { minHeight: 58, borderRadius: 20, backgroundColor: C.orange, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 7, maxWidth: 750, width: '100%', alignSelf: 'center' },
  addButtonText: { color: C.white, fontFamily: BOLD, fontSize: 18, letterSpacing: -0.4 },
  pressed: { transform: [{ scale: 0.96 }], opacity: 0.9 },
  disabled: { opacity: 0.45 },
  previewColumn: { width: 470, paddingTop: 68, paddingHorizontal: 36, alignItems: 'center', borderLeftWidth: 1, borderLeftColor: C.line },
  previewHeading: { width: 290, marginBottom: 15 },
  previewTitle: { color: C.ink, fontFamily: BOLD, fontSize: 20, marginTop: 4 },
  phoneFrame: { width: 290, height: 585, borderWidth: 9, borderColor: C.ink, borderRadius: 38, overflow: 'hidden', backgroundColor: C.cream },
  phoneTop: { height: 24, justifyContent: 'center', alignItems: 'center' },
  phoneNotch: { width: 78, height: 11, borderRadius: 8, backgroundColor: C.ink },
  phoneContent: { paddingHorizontal: 12, paddingTop: 12, paddingBottom: 80 },
  previewLine1: { fontFamily: BOLD, fontSize: 18, color: C.ink },
  previewLine2: { fontFamily: BOLD, fontSize: 30, color: C.orange, marginBottom: 14 },
  previewGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 15 },
  previewCell: { width: '47%', height: 150, transform: [{ scale: 0.96 }] },
  phoneFooter: { position: 'absolute', bottom: 13, left: 11, right: 11, height: 48, borderRadius: 15, backgroundColor: C.orange, alignItems: 'center', justifyContent: 'center' },
  phoneFooterText: { color: C.white, fontFamily: BOLD, fontSize: 19 },
  previewHint: { width: 290, fontSize: 12, color: C.muted, lineHeight: 18, marginTop: 14 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.48)', justifyContent: 'flex-end', alignItems: 'center' },
  sheet: { width: '100%', maxHeight: '92%', backgroundColor: C.cream, borderTopLeftRadius: 25, borderTopRightRadius: 25, paddingHorizontal: 19, paddingTop: 10, paddingBottom: 16 },
  desktopDialog: { width: 540, maxHeight: '88%', alignSelf: 'center', borderRadius: 22, borderWidth: 2, borderColor: C.ink, paddingTop: 18 },
  sheetHandle: { width: 40, height: 4, borderRadius: 4, backgroundColor: '#A89E9C', alignSelf: 'center', marginBottom: 15 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  sheetTitle: { color: C.ink, fontFamily: BOLD, fontSize: 24, marginTop: 3 },
  closeButton: { width: 38, height: 38, borderRadius: 19, borderWidth: 1.5, borderColor: C.ink, alignItems: 'center', justifyContent: 'center', backgroundColor: C.white },
  formContent: { paddingBottom: 15 },
  formLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  counter: { color: C.muted, fontFamily: BOLD, fontSize: 10, marginTop: 15, marginBottom: 7 },
  uploadBox: { minHeight: 101, borderWidth: 1.5, borderColor: C.ink, borderRadius: 15, backgroundColor: C.white, flexDirection: 'row', alignItems: 'center', padding: 11, gap: 12 },
  imagePreview: { width: 82, height: 74, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  previewOrange: { position: 'absolute', width: 69, height: 46, backgroundColor: C.orange, transform: [{ rotate: '-12deg' }] },
  uploadImage: { width: 82, height: 74 },
  uploadEmoji: { fontSize: 48 },
  uploadCopy: { flex: 1 },
  uploadTitle: { color: C.ink, fontFamily: BOLD, fontSize: 11 },
  uploadHint: { color: C.muted, fontSize: 10, lineHeight: 15, marginTop: 5 },
  tipText: { color: C.muted, fontSize: 11, lineHeight: 16, marginTop: 6 },
  removeImage: { alignSelf: 'flex-start', marginTop: 6, paddingVertical: 6, paddingHorizontal: 10 },
  removeImageText: { color: C.danger, fontFamily: BOLD, fontSize: 10 },
  toggleRow: { flexDirection: 'row', gap: 10 },
  dietChoice: { flex: 1, minHeight: 46, borderWidth: 1.5, borderColor: C.line, borderRadius: 13, backgroundColor: C.white, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  dietChoiceSelected: { borderColor: C.ink, backgroundColor: '#F8E9DF' },
  dietMark: { width: 18, height: 18, borderWidth: 2.5, alignItems: 'center', justifyContent: 'center' },
  dietDot: { width: 8, height: 8, borderRadius: 4 },
  dietText: { color: C.ink, fontFamily: BOLD, fontSize: 11 },
  mealChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  mealChip: { minHeight: 37, paddingHorizontal: 12, borderWidth: 1.5, borderColor: C.ink, borderRadius: 18, backgroundColor: C.white, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  mealChipSelected: { backgroundColor: C.ink },
  mealChipText: { color: C.ink, fontFamily: BOLD, fontSize: 10 },
  mealChipTextSelected: { color: C.white },
  activeRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12, borderTopWidth: 1, borderTopColor: C.line, paddingTop: 8 },
  activeHint: { color: C.muted, fontSize: 12, marginTop: -2 },
  primaryButton: { minHeight: 53, backgroundColor: C.orange, borderRadius: 17, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 22, marginTop: 15 },
  primaryButtonText: { color: C.white, fontFamily: BOLD, fontSize: 15 },
  deleteButton: { minHeight: 45, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 8, borderWidth: 1.5, borderColor: C.danger, borderRadius: 15 },
  deleteText: { color: C.danger, fontFamily: BOLD, fontSize: 11 },
  errorText: { color: C.danger, fontSize: 12, lineHeight: 17, marginTop: 10 },
  toast: { position: 'absolute', bottom: Platform.OS === 'web' ? 94 : 84, alignSelf: 'center', maxWidth: '92%', minHeight: 48, backgroundColor: C.ink, borderRadius: 18, paddingLeft: 17, paddingRight: 7, flexDirection: 'row', alignItems: 'center', gap: 10, zIndex: 30 },
  toastMessage: { color: C.white, fontFamily: BOLD, fontSize: 12 },
  undoButton: { paddingHorizontal: 8, paddingVertical: 9 },
  undoText: { color: '#FFC19C', fontFamily: BOLD, fontSize: 11 },
  dismissButton: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  denied: { flex: 1, backgroundColor: C.cream, alignItems: 'center', justifyContent: 'center', padding: 28 },
  deniedIcon: { width: 68, height: 68, borderWidth: 2, borderColor: C.ink, borderRadius: 34, backgroundColor: C.white, alignItems: 'center', justifyContent: 'center', marginBottom: 17 },
  deniedTitle: { color: C.ink, fontFamily: BOLD, fontSize: 21, textAlign: 'center' },
  deniedCopy: { color: C.muted, fontSize: 15, lineHeight: 22, textAlign: 'center', maxWidth: 470, marginTop: 11 },
});