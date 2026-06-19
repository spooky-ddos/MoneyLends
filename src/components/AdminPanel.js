import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Box, Paper, Typography, TextField, Button, IconButton, List, ListItem,
  ListItemText, Chip, Divider, CircularProgress, Dialog, DialogTitle,
  DialogContent, DialogContentText, DialogActions
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon, Add as AddIcon, Delete as DeleteIcon
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { collection, getDocs, addDoc, deleteDoc, doc, query, orderBy, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useUserProfile } from '../contexts/UserProfileContext';
import { useSnackbar } from '../contexts/SnackbarContext';

const formatDate = (createdAt) => {
  if (!createdAt) return 'przed chwilą';
  try {
    const date = typeof createdAt.toDate === 'function' ? createdAt.toDate() : new Date(createdAt);
    return date.toLocaleDateString('pl-PL');
  } catch (e) {
    return '';
  }
};

function AdminPanel() {
  const navigate = useNavigate();
  const { isAdmin, loadingProfile } = useUserProfile();
  const { showSnackbar } = useSnackbar();

  const [version, setVersion] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [entries, setEntries] = useState([]);
  const [loadingEntries, setLoadingEntries] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const loadEntries = useCallback(async () => {
    setLoadingEntries(true);
    try {
      const changelogQuery = query(collection(db, 'changelog'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(changelogQuery);
      setEntries(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (error) {
      console.error('Błąd podczas pobierania wpisów changelogu:', error);
    } finally {
      setLoadingEntries(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) loadEntries();
  }, [isAdmin, loadEntries]);

  const handleAdd = async () => {
    if (!version.trim() || !description.trim()) {
      showSnackbar('Podaj numer wersji oraz opis zmian.', 'warning');
      return;
    }
    setSaving(true);
    try {
      await addDoc(collection(db, 'changelog'), {
        version: version.trim(),
        description: description.trim(),
        createdAt: serverTimestamp()
      });
      setVersion('');
      setDescription('');
      showSnackbar('Dodano wpis do listy zmian.', 'success');
      loadEntries();
    } catch (error) {
      console.error('Błąd podczas dodawania wpisu:', error);
      showSnackbar('Nie udało się dodać wpisu.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteDoc(doc(db, 'changelog', deleteTarget.id));
      showSnackbar('Usunięto wpis.', 'success');
      loadEntries();
    } catch (error) {
      console.error('Błąd podczas usuwania wpisu:', error);
      showSnackbar('Nie udało się usunąć wpisu.', 'error');
    } finally {
      setDeleteTarget(null);
    }
  };

  if (loadingProfile) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!isAdmin) {
    return (
      <Box sx={{ maxWidth: '600px', margin: '2rem auto', padding: { xs: '0.5rem', sm: '2rem' } }}>
        <Paper elevation={3} sx={{ p: 3, backgroundColor: '#ffffff', color: 'rgb(30, 41, 59)', textAlign: 'center' }}>
          <Typography variant="h6" gutterBottom>Brak dostępu</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Ta strona jest dostępna tylko dla administratorów.
          </Typography>
          <Button component={Link} to="/" variant="outlined" startIcon={<ArrowBackIcon />}>
            Powrót
          </Button>
        </Paper>
      </Box>
    );
  }

  return (
    <Box
      component={motion.div}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      sx={{
        maxWidth: '700px',
        width: { xs: '95%', sm: '100%' },
        margin: '2rem auto',
        padding: { xs: '0.5rem', sm: '2rem' }
      }}
    >
      <Paper elevation={3} sx={{ p: { xs: 2, sm: 3 }, backgroundColor: '#ffffff', color: 'rgb(30, 41, 59)' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
          <Button onClick={() => navigate('/')} variant="outlined" startIcon={<ArrowBackIcon />}>
            Powrót
          </Button>
          <Typography variant="h5">Panel administratora</Typography>
        </Box>

        <Typography variant="subtitle1" gutterBottom>Dodaj wpis do listy zmian</Typography>
        <TextField
          label="Numer wersji"
          value={version}
          onChange={(e) => setVersion(e.target.value)}
          fullWidth
          margin="normal"
          placeholder="np. 1.2.0"
        />
        <TextField
          label="Opis zmian"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          fullWidth
          margin="normal"
          multiline
          minRows={3}
          placeholder="Opisz co się zmieniło. Każda linia wyświetli się osobno."
        />
        <Button
          onClick={handleAdd}
          variant="contained"
          startIcon={<AddIcon />}
          disabled={saving}
          sx={{ mt: 1 }}
        >
          {saving ? 'Dodawanie...' : 'Dodaj wpis'}
        </Button>

        <Divider sx={{ my: 3 }} />

        <Typography variant="subtitle1" gutterBottom>Istniejące wpisy</Typography>
        {loadingEntries ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
            <CircularProgress size={28} />
          </Box>
        ) : entries.length === 0 ? (
          <Typography variant="body2" color="text.secondary">Brak wpisów.</Typography>
        ) : (
          <List sx={{ border: '1px solid #ddd', borderRadius: 1 }}>
            {entries.map((entry, index) => (
              <ListItem
                key={entry.id}
                divider={index < entries.length - 1}
                alignItems="flex-start"
                secondaryAction={
                  <IconButton edge="end" aria-label="Usuń" onClick={() => setDeleteTarget(entry)}>
                    <DeleteIcon />
                  </IconButton>
                }
              >
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                      <Chip label={`Wersja ${entry.version}`} color="primary" size="small" />
                      <Typography variant="caption" color="text.secondary">
                        {formatDate(entry.createdAt)}
                      </Typography>
                    </Box>
                  }
                  secondary={
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-line', mt: 0.5 }}>
                      {entry.description}
                    </Typography>
                  }
                />
              </ListItem>
            ))}
          </List>
        )}
      </Paper>

      <Dialog open={deleteTarget !== null} onClose={() => setDeleteTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Usunąć wpis?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Czy na pewno chcesz usunąć wpis dla wersji {deleteTarget?.version}?
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteTarget(null)} color="inherit">Anuluj</Button>
          <Button onClick={handleConfirmDelete} variant="contained" color="error">Usuń</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default AdminPanel;
