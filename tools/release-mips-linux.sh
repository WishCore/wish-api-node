#Version of rebuild.sh with explicit compilation with gcc-4.8
#You must install gcc-4.8 and g++-4.8 

#ARCH=`node -e "console.log(process.arch+'-'+process.platform)"`
ARCH="mips-linux"

echo "Building for ${ARCH}" 
export STAGING_DIR=`pwd`/../build
cd ..; 
CC=mips-openwrt-linux-gcc CXX=mips-openwrt-linux-g++ node-gyp rebuild --arch=mipsel; 
cd tools; 
cp ../build/Release/WishApi.node ../bin/WishApi-${ARCH}.node; 
mips-openwrt-linux-strip ../bin/WishApi-${ARCH}.node; 

