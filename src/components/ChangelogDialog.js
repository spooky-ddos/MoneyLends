import React, { useContext, useEffect, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Typography, Chip, Divider
} from '@mui/material';
import { NewReleases as NewReleasesIcon } from '@mui/icons-material';
import { collection, getDocs, query, orderBy, doc, getDoc, setDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../firebase';
import { AuthContext } from '../contexts/AuthContext';

const formatDate = (createdAt) => {
  if (!createdAt) return '';
  try {
    const date = typeof createdAt.toDate === 'function' ? createdAt.toDate() : new Date(createdAt);
    return date.toLocaleDateString('pl-PL');
  } catch (e) {
    return '';
  }
};

// Globalny popup z listą zmian. Po zalogowaniu pokazuje wpisy changelogu,
// których użytkownik jeszcze nie widział, i oznacza je jako widziane po zamknięciu.
function ChangelogDialog() {
  const { user } = useContext(AuthContext);
  const [entries, setEntries] = useState([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!user) {
      setEntries([]);
      setOpen(false);
      return undefined;
    }

    let cancelled = false;

    const loadChangelog = async () => {
      try {
        const changelogQuery = query(collection(db, 'changelog'), orderBy('createdAt', 'desc'));
        const changelogSnap = await getDocs(changelogQuery);
        const allEntries = changelogSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        const seen = (userSnap.exists() && userSnap.data().seenChangelog) || [];

        const unseen = allEntries.filter(entry => !seen.includes(entry.id));

        if (!cancelled && unseen.length > 0) {
          setEntries(unseen);
          setOpen(true);
        }
      } catch (error) {
        console.error('Błąd podczas pobierania listy zmian:', error);
      }
    };

    loadChangelog();
    return () => { cancelled = true; };
  }, [user]);

  const handleClose = async () => {
    setOpen(false);
    if (user && entries.length > 0) {
      try {
        const userRef = doc(db, 'users', user.uid);
        await setDoc(
          userRef,
          { seenChangelog: arrayUnion(...entries.map(e => e.id)) },
          { merge: true }
        );
      } catch (error) {
        console.error('Błąd podczas oznaczania zmian jako przeczytane:', error);
      }
    }
  };

  if (!open || entries.length === 0) return null;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <NewReleasesIcon color="primary" />
        Co nowego?
      </DialogTitle>
      <DialogContent dividers>
        {entries.map((entry, index) => (
          <Box key={entry.id} sx={{ mb: index < entries.length - 1 ? 2 : 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, flexWrap: 'wrap' }}>
              <Chip label={`Wersja ${entry.version}`} color="primary" size="small" />
              {entry.createdAt && (
                <Typography variant="caption" color="text.secondary">
                  {formatDate(entry.createdAt)}
                </Typography>
              )}
            </Box>
            <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>
              {entry.description}
            </Typography>
            {index < entries.length - 1 && <Divider sx={{ mt: 2 }} />}
          </Box>
        ))}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} variant="contained">Rozumiem</Button>
      </DialogActions>
    </Dialog>
  );
}

export default ChangelogDialog;
