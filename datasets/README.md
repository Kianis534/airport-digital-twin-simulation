# Datasets

| File | Source | Rows | Used for |
| --- | --- | ---: | --- |
| `dataset_1_airlines.csv` | [2015 Flight Delays and Cancellations](https://www.kaggle.com/datasets/usdot/flight-delays) (US DOT, via Kaggle) | 14 | Airline codes for the delay model |
| `dataset_1_airports.csv` | same | 322 | Airport codes for the delay model |
| `raw/flights.csv` *(not in git)* | same | 5,819,079 | Flight-delay regressor |
| `dataset_2_train.csv` | [Airline Passenger Satisfaction](https://www.kaggle.com/datasets/teejmahal20/airline-passenger-satisfaction) (Kaggle) | 103,904 | Satisfaction classifier (training) |
| `dataset_2_test.csv` | same | 25,976 | Satisfaction classifier (held-out test), simulated passenger profiles |
| `dataset_3_passenger_traffic.csv` | [Air Traffic Passenger Statistics](https://data.sfgov.org/Transportation/Air-Traffic-Passenger-Statistics/rkru-6vcg) (San Francisco International Airport, DataSF) | 15,007 | LSTM monthly demand forecast (Jul 2005 to Mar 2016) |

## Getting the flights file

`flights.csv` is 565 MB, above GitHub's file size limit, so it is not committed. Everything
else in the project works without it: the simulation samples departure delays from the
empirical distribution of the 129,880 flights recorded in the passenger survey.

To train the delay regressor:

1. Download `flights.csv` from the Kaggle dataset linked above (a free Kaggle account is needed).
2. Save it as `datasets/raw/flights.csv`.
3. Run:

   ```bash
   python -m preprocessing.pipeline
   python -m ml_models.train_delay_model
   python -m ml_models.export_artifacts
   ```

## Licences

The datasets belong to their publishers and are redistributed here for research and
education under their original terms. Check each source page before commercial use.
