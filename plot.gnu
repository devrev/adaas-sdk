set datafile separator ','
set key autotitle columnhead
set grid

# Get number of columns
stats 'memory-filled-basic.csv' nooutput
ncols = STATS_columns

# Plot all columns except first (timestamp)
plot for [i=2:ncols] 'memory-filled-basic.csv' using 1:i with lines lw 2

# set terminal png size 1200,800
# set output 'graph.png'
