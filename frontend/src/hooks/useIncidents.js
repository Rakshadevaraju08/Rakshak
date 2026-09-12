import { useState, useEffect, useCallback } from 'react';
import { fetchIncidents, fetchIncidentById } from '../services/incidentService';

export function useIncidents() {
  const [incidents, setIncidents] = useState([]);
  const [selectedIncident, setSelectedIncident] = useState(null);
  
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  
  const [errorList, setErrorList] = useState(null);
  const [errorDetail, setErrorDetail] = useState(null);

  const loadIncidents = useCallback(async () => {
    setLoadingList(true);
    setErrorList(null);
    try {
      const data = await fetchIncidents();
      setIncidents(data || []);
    } catch (err) {
      setErrorList(err.message || 'An error occurred while loading incidents.');
    } finally {
      setLoadingList(false);
    }
  }, []);

  const selectIncident = useCallback(async (id) => {
    if (!id) {
      setSelectedIncident(null);
      return;
    }
    
    setLoadingDetail(true);
    setErrorDetail(null);
    try {
      const data = await fetchIncidentById(id);
      setSelectedIncident(data);
    } catch (err) {
      setErrorDetail(err.message || 'An error occurred while loading incident details.');
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadIncidents();
  }, [loadIncidents]);

  return {
    incidents,
    selectedIncident,
    loadingList,
    loadingDetail,
    errorList,
    errorDetail,
    isEmpty: !loadingList && !errorList && incidents.length === 0,
    retryList: loadIncidents,
    selectIncident,
    retryDetail: () => selectedIncident && selectIncident(selectedIncident.id)
  };
}
